import { describe, expect, it } from 'vitest'
import { isValidQQMailboxEmail } from '@/lib/qq-email'

describe('QQ mailbox email validation', () => {
  it.each([
    '12345@qq.com',
    '123456789@qq.com',
    'david007@qq.com',
    'abc@qq.com',
    'abc-def@qq.com',
    'abc_def@qq.com',
    'abc.def@qq.com',
    'abc@foxmail.com',
    'abc-def@foxmail.com',
    'abc@vip.qq.com',
    'abc.def@vip.qq.com',
    'abcdefghijklmnopqr@qq.com',
    'ABC.DEF@QQ.COM',
  ])('accepts %s', (email) => {
    expect(isValidQQMailboxEmail(email)).toBe(true)
  })

  it.each([
    '',
    '@qq.com',
    'abc',
    'ab@qq.com',
    '1abc@qq.com',
    'abc+tag@qq.com',
    'abc..def@qq.com',
    'abc__def@qq.com',
    'abc-_def@qq.com',
    'abc-@qq.com',
    '.abc@qq.com',
    'abc@qq.com.cn',
    'abc@gmail.com',
    'abc@163.com',
    '12345@foxmail.com',
    '12345@vip.qq.com',
    'abcdefghijklmnopqrs@qq.com',
    '1234@qq.com',
    '1234567890123@qq.com',
    '012345@qq.com',
    'abc@sub.qq.com',
  ])('rejects %s', (email) => {
    expect(isValidQQMailboxEmail(email)).toBe(false)
  })
})
