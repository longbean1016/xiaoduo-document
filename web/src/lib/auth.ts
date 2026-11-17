import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { db } from '@/db/client'
import { account, session, user, verification } from '@/db/schema'

const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'

export const auth = betterAuth({
  appName: '知笺',
  baseURL: appOrigin,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    'zhijian-development-secret-change-before-production',
  trustedOrigins: [appOrigin],
  database: drizzleAdapter(db, {
    provider: 'mysql',
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: Number(process.env.BETTER_AUTH_RATE_LIMIT_MAX ?? 20),
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: Number(process.env.BETTER_AUTH_RATE_LIMIT_MAX ?? 20),
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'collaborator',
      },
      status: {
        type: 'string',
        required: true,
        defaultValue: 'active',
      },
    },
  },
  plugins: [
    emailOTP({
      allowedAttempts: 5,
      disableSignUp: true,
      expiresIn: 600,
      resendStrategy: 'rotate',
      storeOTP: 'hashed',
      rateLimit: { window: 60, max: 5 },
      async sendVerificationOTP() {
        // OTP delivery is gated by the collaboration request endpoints.
      },
    }),
    nextCookies(),
  ],
})
