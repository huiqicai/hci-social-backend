import {
  ApiDefineTag, ApiOperationSummary, ApiResponse, ApiUseTag, Context, createSession, dependency, hashPassword, HttpResponseOK,
  HttpResponseUnauthorized, Post, Store, UserRequired, ValidateBody, verifyPassword
} from '@foal/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { randomBytes } from 'crypto';
import { JwtPayload, sign, verify, VerifyErrors } from 'jsonwebtoken';
import { JTDDataType } from '../../jtd';
import { Mail, Prisma } from '../../services';

const credentialsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  },
  required: ['email', 'password'],
} as const;

type Credentials = JTDDataType<typeof credentialsSchema>;

const requestResetSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
} as const;

type ResetRequest = JTDDataType<typeof requestResetSchema>;

const passwordResetSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    password: { type: 'string' },
  },
  required: ['token', 'password'],
} as const;

type PasswordReset = JTDDataType<typeof passwordResetSchema>;

const otpSecret = randomBytes(32).toString('base64');

class InvalidTokenResponse extends HttpResponseUnauthorized {

  constructor(description: string) {
    super({ code: 'invalid_token', description });
    this.setHeader(
      'WWW-Authenticate',
      `error="invalid_token", error_description="${description}"`
    );
  }

}

@ApiDefineTag({
  name: 'Authentication',
  description: 'An API exists that manages much of the work for account creation and management as well. ' +
    'This will manage login, set password, register, etc. To make authenticated requests after logging in, ' +
    'set the `Authorization` HTTP header with the value `Bearer <token>`'
})
@ApiUseTag('Authentication')
export class AuthController {
  @dependency
  store: Store;

  @dependency
  mail: Mail;

  @dependency
  prisma: Prisma;

  @Post('/signup')
  @ValidateBody(credentialsSchema)
  async signup(ctx: Context) {
    const body: Credentials = ctx.request.body as Credentials;
    
    // TODO: Allow setting attributes at signup?
    const user = await this.prisma.client.user.create({
      data: {
        email: body.email,
        password: await hashPassword(body.password)
      }
    })

    ctx.session = await createSession(this.store);
    ctx.session.setUser(user);

    return new HttpResponseOK({
      token: ctx.session.getToken(),
      userID: user.id
    });
  }

  @Post('/login')
  @ValidateBody(credentialsSchema)
  async login(ctx: Context) {
    const body: Credentials = ctx.request.body as Credentials;

    const user = await this.prisma.client.user.findUnique({
      where: { email: body.email }
    })

    if (!user) return new HttpResponseUnauthorized();

    if (!await verifyPassword(body.password, user.password)) {
      return new HttpResponseUnauthorized();
    }

    ctx.session = await createSession(this.store);
    ctx.session.setUser(user);

    return new HttpResponseOK({
      token: ctx.session.getToken(),
      userID: user.id
    });
  }

  @Post('/logout')
  async logout(ctx: Context) {
    if (ctx.session) {
      await ctx.session.destroy();
    }

    return new HttpResponseOK();
  }

  @Post('/verify')
  @ApiOperationSummary('Check if the provided session token is valid')
  @ApiResponse(200, { description: 'API token is valid' })
  @ApiResponse(401, { description: 'API token is missing or invalid' })
  @UserRequired()
  async verify() {
    return new HttpResponseOK();
  }

  @Post('/request-reset')
  @ApiOperationSummary('Send an email to a user with a password reset token if such a user exists')
  @ValidateBody(requestResetSchema)
  async requestOTP(ctx: Context) {
    const body: ResetRequest = ctx.request.body as ResetRequest;

    const user = await this.prisma.client.user.findUnique({
      where: { email: body.email },
      select: { id: true }
    });

    // Don't give away any extra information
    if (!user) return new HttpResponseOK();

    const token = sign(
      { sub: user.id, id: user.id, email: body.email },
      otpSecret,
      { expiresIn: '1h' }
    );

    this.mail.send(
      body.email,
      'Password Reset',
      `Your password reset token is ${token}. It will expire in one hour. Please return to the application to continue resetting your password.`
    );

    return new HttpResponseOK();
  }

  @Post('/reset-password')
  @ApiOperationSummary('Reset a user\'s password using a password reset token')
  @ValidateBody(passwordResetSchema)
  async resetPassword(ctx: Context) {
    const body: PasswordReset = ctx.request.body as PasswordReset;

    const payload: JwtPayload = await new Promise((resolve, reject) => {
      verify(body.token, otpSecret, {}, (err: VerifyErrors | null, value: JwtPayload | string | undefined) => {
        if (err || !value || typeof(value) === 'string') {
          reject(new InvalidTokenResponse(err?.message ?? 'Invalid Token'));
        } else {
          resolve(value);
        }
      });
    });

    if (!payload.sub) return new InvalidTokenResponse('Invalid user');

    try {
      await this.prisma.client.user.update({
        where: { id: parseInt(payload.sub) },
        data: { password: await hashPassword(body.password) }
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new InvalidTokenResponse('Invalid user');
      }
      throw e;
    }

    return new HttpResponseOK();
  }
}