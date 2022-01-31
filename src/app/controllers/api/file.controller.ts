import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Config, Context, Delete, dependency, Get, HttpResponseBadRequest, HttpResponseClientError, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post,
  UserRequired, ValidatePathParam
} from '@foal/core';
import { Disk, File as FoalFile, ValidateMultipartFormDataBody } from '@foal/storage';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { ValidateQuery } from '../../hooks';
import { JTDDataType } from '../../jtd';
import { Prisma as PrismaService } from '../../services';
import { apiAttributesToPrisma, attributeSchema } from '../../utils';

const extensions = [
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  // Audio
  'wav', 'mp3', 'wma', 'mov',
  // Video
  'mp4', 'avi', 'wmv',
  // Audio/video
  'webm'
];

const baseFileSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    uploaderID: { type: 'number' },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: [ 'ownerID' ],
} as const;

const findFilesSchema = {
  ...baseFileSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseFileSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindFilesSchema = JTDDataType<typeof findFilesSchema>;

const createFileSchema = {
  ...baseFileSchema,
  required: ['uploaderId']
} as const;

type CreateFileSchema = JTDDataType<typeof createFileSchema>;

const modifyFileSchema = baseFileSchema;

type ModifyFileSchema = JTDDataType<typeof modifyFileSchema>;

@ApiDefineTag({
  name: 'File Upload',
  description: 'This dataset allows for uploads of files, such as profile pictures or post thumbnails'
})
@ApiUseTag('File Upload')
export class FileUploadController {
  @dependency
  disk: Disk

  @dependency
  prisma: PrismaService

  async deleteFileWithPath(fullPath: string) {
    const oldPathMatch = fullPath.match(/\/uploads\/(.*)$/);
    if (oldPathMatch) {
      await this.disk.delete(oldPathMatch[1]);
    } else {
      throw new Error(`Tried to delete file at path ${fullPath}, but the path was invalid`);
    }
  }

  async maybeUploadFile(file: FoalFile, fileId?: number): Promise<HttpResponseClientError | { path: string, size: number }> {
    const fileSize = file.buffer.byteLength;

    const res = await this.prisma.client.file.aggregate({
      // If we're replacing an existing file, omit the old file size from the sum, since it will be
      // going away
      where: fileId ? {NOT: {id: fileId}} : {},
      _sum: { size: true }
    });

    // Max total upload size: 100MB
    if ((res._sum.size ?? 0) + fileSize > 1024*1024*100) {
      return new HttpResponseBadRequest({
        headers: {
          error: 'FILE_STORAGE_EXCEEDED',
          message: 'Application file storage exceeded'
        }
      });
    }

    const invalidExt = new HttpResponseBadRequest({
      headers: {
        error: 'FILE_INVALID_EXTENSION',
        message: 'Invalid file extension'
      }
    });

    if (!file.filename) {
      return invalidExt;
    }

    const fileExt = file.filename.match(/\.(\w+)/);

    if (!fileExt || !extensions.includes(fileExt[1])) {
      return invalidExt;
    }

    const prefix = Config.get('api_prefix', 'string', '');
    const { path } = await this.disk.write('files', file.buffer, {
      extension: fileExt[1]
    });

    const fullPath = `${prefix}/uploads/${path}`;

    return {
      path: fullPath,
      size: fileSize
    }
  }

  @Get()
  @ApiOperationId('findFiles')
  @ApiOperationSummary('Find files.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of files.' })
  @ValidateQuery(findFilesSchema)
  async findFiles(ctx: Context) {
    const query = ctx.request.query as FindFilesSchema;

    const where: Prisma.FileWhereInput = {
      uploaderID: query.uploaderID,
      AND: apiAttributesToPrisma(query.attributes)
    }

    const res = await this.prisma.client.$transaction([
      this.prisma.client.file.findMany({
        skip: query.skip,
        take: query.take,
        where
      }),
      this.prisma.client.file.count({where})
    ]);

    return new HttpResponseOK(res);
  }

  @Get('/:fileId')
  @ApiOperationId('findFileById')
  @ApiOperationSummary('Find a file by ID.')
  @ApiResponse(404, { description: 'File not found.' })
  @ApiResponse(200, { description: 'Returns the file information.' })
  @ValidatePathParam('fileId', { type: 'number' })
  async findFileById(ctx: Context) {
    const params = ctx.request.params as {fileId: number};
    const file = await this.prisma.client.file.findUnique({
      where: { id: params.fileId }
    });

    if (!file) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(file);
  }

  @Post()
  @ApiOperationId('uploadFile')
  @ApiOperationSummary('Upload a file.')
  @ApiOperationDescription(
    'Upload a file. Note that this endpoint requires the multipart/form-data content type, NOT application/json. ' +
    'For reference on how to upload files with fetch, see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#uploading_a_file ' +
    'There is a limit of 10MB per file, and a total of 100MB of uploads. ' +
    'Additionally, for security reasons only the following file types are supported: ' +
    extensions.join(', ')
  )
  @ApiResponse(400, { description: 'Invalid file.' })
  @ApiResponse(201, { description: 'File successfully uploaded. Returns the file information.' })
  @UserRequired()
  @ValidateMultipartFormDataBody({
    fields: createFileSchema,
    files: {
      file: { required: true }
    }
  })
  async uploadFile(ctx: Context) {
    const body = ctx.request.body as CreateFileSchema & { files: {file: FoalFile} };
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const file = body.files.file;
    const uploadResult = await this.maybeUploadFile(file);

    if (uploadResult instanceof HttpResponseClientError) {
      return uploadResult;
    }

    try {
      const fileRes = this.prisma.client.file.create({
        data: {
          uploaderID: body.uploaderID,
          path: uploadResult.path,
          size: uploadResult.size,
          attributes
        }
      });
      return new HttpResponseCreated(fileRes);
    } catch(e) {
      // We failed to save the file, so to prevent leaking disk usage, we'll clean up the orphaned upload
      await this.deleteFileWithPath(uploadResult.path);
      throw e;
    }
  }

  @Patch('/:fileId')
  @ApiOperationId('modifyFile')
  @ApiOperationSummary('Update/modify an existing file.')
  @ApiOperationDescription(
    'Update/modify an existing file. Note that this endpoint requires the multipart/form-data content type, NOT application/json. ' +
    'For reference on how to upload files with fetch, see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#uploading_a_file ' +
    'There is a limit of 10MB per file, and a total of 100MB of uploads. ' +
    'Additionally, for security reasons only the following file types are supported: ' +
    extensions.join(', ')
  )
  @ApiResponse(400, { description: 'Invalid file.' })
  @ApiResponse(404, { description: 'File not found.' })
  @ApiResponse(200, { description: 'File successfully updated. Returns the file information.' })
  @UserRequired()
  @ValidatePathParam('fileId', { type: 'number' })
  @ValidateMultipartFormDataBody({
    fields: modifyFileSchema,
    files: {
      file: { required: false }
    }
  })
  async modifyFile(ctx: Context) {
    const params = ctx.request.params as { fileId: number };
    const body = ctx.request.body as ModifyFileSchema & { files: {file?: FoalFile} };
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const file = body.files.file;
    let path: string | undefined;
    let size: number | undefined;
    let originalPath: string | undefined;
    if (file) {
      const originalFile = await this.prisma.client.file.findUnique({
        select: {path: true},
        where: {id: params.fileId }
      });
      originalPath = originalFile?.path ?? undefined;
      const uploadResult = await this.maybeUploadFile(file, params.fileId);
      if (uploadResult instanceof HttpResponseClientError) {
        return uploadResult;
      }
      path = uploadResult.path;
      size = uploadResult.size;
    }

    let fileRes;
    try {
      fileRes = await this.prisma.client.file.update({
        where: { id: params.fileId },
        data: {
          uploaderID: body.uploaderID,
          path,
          size,
          attributes
        }
      });
    } catch(e) {
      // We failed to save the file, so to prevent leaking disk usage, we'll clean up the orphaned upload
      if (path) await this.deleteFileWithPath(path);

      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }

    // If this fails, we've already saved the changed file, so we don't want to remove the new file -
    // however, I don't want to just silently eat the error, as most likely it means something went
    // sideways
    if (originalPath) await this.deleteFileWithPath(originalPath);
    return new HttpResponseOK(fileRes);
  }

  @Delete('/:fileId')
  @ApiOperationId('deleteFile')
  @ApiOperationSummary('Delete a file.')
  @ApiResponse(404, { description: 'File not found.' })
  @ApiResponse(204, { description: 'File successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('fileId', { type: 'number' })
  async deleteFile(ctx: Context) {
    const params = ctx.request.params as { fileId: number };

    try {
      const res = await this.prisma.client.file.delete({
        select: { path: true },
        where: { id: params.fileId }
      });
      await this.deleteFileWithPath(res.path);

      return new HttpResponseNoContent();
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to delete not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

}
