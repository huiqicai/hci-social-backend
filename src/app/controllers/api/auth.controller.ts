import {
  ApiDefineTag, ApiOperationDescription, ApiOperationSummary, ApiResponse, ApiUseTag, Context, createSession, dependency, hashPassword, Hook, HttpResponseNotFound, HttpResponseOK,
  HttpResponseUnauthorized, Post, Store, UserRequired, UseSessions, ValidateBody, verifyPassword
} from '@foal/core';
import { randomBytes } from 'crypto';
import { sign, verify } from "jsonwebtoken";
import * as nodemailer from 'nodemailer';
import { getRepository } from 'typeorm';

import { User } from '../../entities';

const credentialsSchema = {
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  },
  required: ['email', 'password'],
  type: 'object',
};

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

  @Post('/signup')
  @ValidateBody(credentialsSchema)
  async signup(ctx: Context) {
    const user = new User();
    user.email = ctx.request.body.email;
    user.password = ctx.request.body.password;
    // TODO: Allow these to be configurable at signup?
    user.username = '';
    user.firstName = '';
    user.lastName = '';
    user.status = '';
    user.role = '';
    await user.save();

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
    const passwordQueryResult = await User.findOne({
      where: {
        email: ctx.request.body.email
      },
      select: ['password']
    });

    if (!passwordQueryResult) {
      return new HttpResponseUnauthorized();
    }

    if (!await verifyPassword(ctx.request.body.password, passwordQueryResult.password)) {
      return new HttpResponseUnauthorized();
    }

    // A shame that we have to do this twice, but TypeORM doesn't have a way to force select
    // columns with `select: false` set.
    const user = await User.findOne({
      email: ctx.request.body.email
    });

    if (!user) {
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
  @ApiOperationSummary("")
  @ApiResponse(200, { description: "API token is valid" })
  @ApiResponse(401, { description: "API token is missing or invalid" })
  @UserRequired()
  async verify() {
    return new HttpResponseOK();
  }

  @Post('/request-reset')
  @ApiOperationSummary("Send an email to a user with a password reset token if such a user exists")
  @ValidateBody({
    properties: {
      email: { type: 'string', format: 'email' },
    },
    required: ['email'],
    type: 'object',
  })
  async requestOTP(ctx: Context) {
    const email = ctx.request.body.email;

    const user = await getRepository(User).findOne({ email });
    // Don't give away any extra information
    if (!user) return new HttpResponseOK();

    const token = sign(
      { sub: user.id, id: user.id, email },
      otpSecret,
      { expiresIn: '1h' }
    );
    if (process.env.NODE_ENV === 'production') {
      nodemailer.createTransport({sendmail: true}).sendMail({
        to: ctx.request.query.email,
        subject: 'Password Reset',
        text: `Your password reset token is ${token}. It will expire in one hour. Please return to the application to continue resetting your password.`
      });
    } else {
      console.log(`Password reset triggered for ${email}. Token: ${token}`);
    }
    return new HttpResponseOK();
  }

  @Post('/reset-password')
  @ApiOperationSummary("Reset a user's password using a password reset token")
  @ValidateBody({
    properties: {
      token: { type: 'string' },
      password: { type: 'string' },
    },
    required: ['token', 'password'],
    type: 'object',
  })
  async resetPassword(ctx: Context) {
    let payload: Record<string, string>;
    try {
      payload = await new Promise((resolve, reject) => {
        verify(ctx.request.body.token, otpSecret, {}, (err: any, value: object | undefined) => {
          if (err || !value) { reject(err || 'Invalid Token'); } else { resolve(value as Record<string, string>); }
        });
      });
    } catch (error) {
      return new InvalidTokenResponse(error.message);
    }

    const user = await getRepository(User).findOne({ id: +payload.sub });
    if (!user) return new InvalidTokenResponse('Invalid user');
    user.password = ctx.request.body.password;
    user.save();

    return new HttpResponseOK();
  }
}