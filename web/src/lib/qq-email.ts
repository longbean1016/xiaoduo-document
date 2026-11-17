const NUMERIC_QQ_ACCOUNT = /^[1-9]\d{4,11}$/
const ENGLISH_ACCOUNT =
  /^(?=.{3,18}$)(?![0-9]+$)[a-z](?!.*[._-]{2})[a-z0-9._-]*[a-z0-9]$/

const QQ_MAILBOX_DOMAINS = new Set([
  'qq.com',
  'foxmail.com',
  'vip.qq.com',
])

export function isValidQQMailboxEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!email || email.length > 254) return false

  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return false
  if (email.indexOf('@') !== at) return false

  const account = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!QQ_MAILBOX_DOMAINS.has(domain)) return false

  if (domain === 'qq.com' && NUMERIC_QQ_ACCOUNT.test(account)) {
    return true
  }

  return ENGLISH_ACCOUNT.test(account)
}
