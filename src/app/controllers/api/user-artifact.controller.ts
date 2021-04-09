import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Config, Context, Delete, dependency, Get, HttpResponseBadRequest, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post,
  Put, UserRequired, ValidateBody, ValidatePathParam, ValidateQueryParam
} from '@foal/core';
import { Disk, File as FoalFile, ValidateMultipartFormDataBody } from '@foal/storage';
import { getRepository } from 'typeorm';

import { UserArtifact, User } from '../../entities';
import { ValidateQuery } from '../../hooks';
import { removeEmptyParams } from '../../utils';

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

const userArtifactSchema = {
  additionalProperties: false,
  properties: {
    ownerID: { type: 'number' },
    type: {
      type: 'string',
      description: 'Implementation specific field to define types of artifacts; this could be "picture", ' +
        '"document", "title" - whatever makes sense for your system.'
    },
    url: {
      type: 'string',
      description: 'The path to the artifact; it could be a local path if the artifact is an uploaded file, ' +
        'or a full URL if it is a link to a remote artifact'
    },
    category: {
      type: 'string',
      description: 'Implementation specific field to categorize artifacts; this could be "profile pictures", ' +
        'or "favorite posts" or "associated accounts" - whatever makes sense for your system.'
    }
  },
  required: [ 'ownerID' ],
  type: 'object',
};

function getUserArtifactParams(params: any, undefinedMode: 'remove' | 'default') {
  const resetDefaults = undefinedMode === 'default';

  const res = {
    owner: {
      id: params.ownerID
    },
    type: resetDefaults ? params.type ?? '' : params.type,
    url: resetDefaults ? params.url ?? '' : params.url,
    category: resetDefaults ? params.category ?? '' : params.category
  }

  return undefinedMode === 'remove' ? removeEmptyParams(res) : res;
}

@ApiDefineTag({
  name: 'User Artifact',
  description: 'This is an implementation specific dataset that can hold any additional information or data ' +
    'for a particular user in a categorizable way. This could be a profile picture, birthday, ' +
    'timeline photo, job title, etc.'
})
@ApiUseTag('User Artifact')
export class UserArtifactController {
  @dependency
  disk: Disk

  async deleteUAFile(userArtifact: UserArtifact) {
    const oldPathMatch = userArtifact.url.match(/\/uploads\/(.*)$/);
    if (userArtifact.size > 0 && oldPathMatch) {
      await this.disk.delete(oldPathMatch[1]);
      userArtifact.size = 0;
      userArtifact.url = '';
      await getRepository(UserArtifact).save(userArtifact);
    }
  }

  @Get()
  @ApiOperationId('findUserArtifacts')
  @ApiOperationSummary('Find user artifacts.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of user artifacts.' })
  @ValidateQueryParam('skip', { type: 'number' }, { required: false })
  @ValidateQueryParam('take', { type: 'number' }, { required: false })
  @ValidateQuery({...userArtifactSchema, required: []})
  async findUserArtifacts(ctx: Context<User>) {
    const userArtifacts = await getRepository(UserArtifact).findAndCount({
      skip: ctx.request.query.skip,
      take: ctx.request.query.take,
      where: getUserArtifactParams(ctx.request.query, 'remove')
    });
    return new HttpResponseOK(userArtifacts);
  }

  @Get('/:userArtifactId')
  @ApiOperationId('findUserArtifactById')
  @ApiOperationSummary('Find a user artifact by ID.')
  @ApiResponse(404, { description: 'User artifact not found.' })
  @ApiResponse(200, { description: 'Returns the user artifact.' })
  @ValidatePathParam('userArtifactId', { type: 'number' })
  async findUserArtifactById(ctx: Context<User>) {
    const userArtifact = await getRepository(UserArtifact).findOne({
      id: ctx.request.params.userArtifactId
    });

    if (!userArtifact) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(userArtifact);
  }

  @Post()
  @ApiOperationId('createUserArtifact')
  @ApiOperationSummary('Create a new user artifact.')
  @ApiResponse(404, { description: 'User artifact not found.' })
  @ApiResponse(400, { description: 'Invalid user artifact.' })
  @ApiResponse(201, { description: 'User artifact successfully created. Returns the user artifact.' })
  @UserRequired()
  @ValidateBody(userArtifactSchema)
  async createUserArtifact(ctx: Context<User>) {
    const userArtifact = await getRepository(UserArtifact).save(
      getUserArtifactParams(ctx.request.body, 'default')
    );
    return new HttpResponseCreated(userArtifact);
  }

  @Post('/:userArtifactId/upload')
  @ApiOperationId('uploadFile')
  @ApiOperationSummary('Upload a file as the contents of a user artifact.')
  @ApiOperationDescription(
    'Upload a file as the contents of a user artifact. This will override the URL property, and if a future ' +
    'PUT or PATCH changes the URL, the file will be removed. There is a limit of 10MB per file, and a total of 100MB ' +
    'of uploads. Additionally, for security reasons only the following file types are supported: ' +
    extensions.join(', ')
  )
  @ApiResponse(400, { description: 'Invalid file.' })
  @ApiResponse(201, { description: 'File successfully attached to the user artifact. Returns modified user artifact' })
  @UserRequired()
  @ValidateMultipartFormDataBody({
    files: {
      file: { required: true }
    }
  })
  @ValidatePathParam('userArtifactId', { type: 'number' })
  async uploadFile(ctx: Context) {
    const userArtifact = await getRepository(UserArtifact).findOne({
      id: ctx.request.params.userArtifactId
    });

    if (!userArtifact) {
      return new HttpResponseNotFound();
    }

    const file = ctx.request.body.files.file as FoalFile;
    const fileSize = file.buffer.byteLength;

    const { sum } = await getRepository(UserArtifact)
      .createQueryBuilder()
      .addSelect('SUM(ua_size)', 'sum')
      .getRawOne();

    // Max total upload size: 100MB
    if (parseInt(sum) + fileSize > 1024*1024*100) {
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

    await this.deleteUAFile(userArtifact);

    const prefix = Config.get('api_prefix', 'string', '');
    const { path } = await this.disk.write('user-artifacts', file.buffer, {
      extension: fileExt[1]
    });

    const fullPath = `${prefix}/uploads/${path}`;

    userArtifact.url = fullPath;
    userArtifact.size = fileSize;
    await getRepository(UserArtifact).save(userArtifact);

    return new HttpResponseOK(userArtifact);
  }

  @Patch('/:userArtifactId')
  @ApiOperationId('modifyUserArtifact')
  @ApiOperationSummary('Update/modify an existing user artifact.')
  @ApiResponse(400, { description: 'Invalid user artifact.' })
  @ApiResponse(404, { description: 'User artifact not found.' })
  @ApiResponse(200, { description: 'User artifact successfully updated. Returns the user artifact.' })
  @UserRequired()
  @ValidatePathParam('userArtifactId', { type: 'number' })
  @ValidateBody({ ...userArtifactSchema, required: [] })
  async modifyUserArtifact(ctx: Context<User>) {
    const userArtifact = await getRepository(UserArtifact).findOne({
      id: ctx.request.params.userArtifactId
    });

    if (!userArtifact) {
      return new HttpResponseNotFound();
    }

    const params = getUserArtifactParams(ctx.request.body, 'remove');

    if (params.url !== undefined) {
      await this.deleteUAFile(userArtifact);
    }

    Object.assign(userArtifact, params);

    await getRepository(UserArtifact).save(userArtifact);

    return new HttpResponseOK(userArtifact);
  }

  @Put('/:userArtifactId')
  @ApiOperationId('replaceUserArtifact')
  @ApiOperationSummary('Update/replace an existing user artifact.')
  @ApiResponse(400, { description: 'Invalid user artifact.' })
  @ApiResponse(404, { description: 'User artifact not found.' })
  @ApiResponse(200, { description: 'User artifact successfully updated. Returns the user artifact.' })
  @UserRequired()
  @ValidatePathParam('userArtifactId', { type: 'number' })
  @ValidateBody(userArtifactSchema)
  async replaceUserArtifact(ctx: Context<User>) {
    const userArtifact = await getRepository(UserArtifact).findOne({
      id: ctx.request.params.userArtifactId
    });

    if (!userArtifact) {
      return new HttpResponseNotFound();
    }

    await this.deleteUAFile(userArtifact);

    Object.assign(userArtifact, getUserArtifactParams(ctx.request.body, 'default'));

    await getRepository(UserArtifact).save(userArtifact);

    return new HttpResponseOK(userArtifact);
  }

  @Delete('/:userArtifactId')
  @ApiOperationId('deleteUserArtifact')
  @ApiOperationSummary('Delete a user artifact.')
  @ApiResponse(404, { description: 'User artifact not found.' })
  @ApiResponse(204, { description: 'User artifact successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('userArtifactId', { type: 'number' })
  async deleteUserArtifact(ctx: Context<User>) {
    const userArtifact = await getRepository(UserArtifact).findOne({
      id: ctx.request.params.userArtifactId
    });

    if (!userArtifact) {
      return new HttpResponseNotFound();
    }

    await this.deleteUAFile(userArtifact);

    await getRepository(UserArtifact).delete(ctx.request.params.userArtifactId);

    return new HttpResponseNoContent();
  }

}
