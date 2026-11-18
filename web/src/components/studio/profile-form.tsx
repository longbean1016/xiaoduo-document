'use client'

import { ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthorAvatar } from '@/components/author-avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { compressImageForUpload } from '@/lib/image-compression'

interface ProfileValues {
  authorName: string
  avatarUrl: string
  roleTitle: string
  intro: string
  nowText: string
  location: string
  email: string
}

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [values, setValues] = useState(initial)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [avatarPending, setAvatarPending] = useState(false)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [removeAvatarOpen, setRemoveAvatarOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatarPreviewRef = useRef('')

  useEffect(
    () => () => {
      if (avatarPreviewRef.current) {
        URL.revokeObjectURL(avatarPreviewRef.current)
      }
    },
    [],
  )

  function replaceAvatarPreview(url: string) {
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current)
    }
    avatarPreviewRef.current = url.startsWith('blob:') ? url : ''
    setAvatarPreviewUrl(url)
  }

  async function selectAvatar(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarPending(true)
    setMessage('')
    try {
      const image = await compressImageForUpload(file)
      const signResponse = await fetch('/api/studio/profile/avatar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contentType: image.contentType,
          size: image.blob.size,
        }),
      })
      const signPayload = (await signResponse.json()) as {
        upload?: {
          uploadUrl: string
          publicUrl: string
          contentType: string
        }
        error?: string
      }
      if (!signResponse.ok || !signPayload.upload) {
        throw new Error(
          signPayload.error === 'OSS_NOT_CONFIGURED'
            ? '对象存储尚未配置。'
            : '无法创建头像上传地址。',
        )
      }

      const upload = signPayload.upload
      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': upload.contentType },
        body: image.blob,
      })
      if (!uploadResponse.ok) {
        throw new Error('头像上传失败，请重试。')
      }
      replaceAvatarPreview(upload.publicUrl)
      setValues((current) => ({
        ...current,
        avatarUrl: upload.publicUrl,
      }))
      setMessage('头像上传成功，保存资料后生效。')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '头像处理失败。',
      )
    } finally {
      setAvatarPending(false)
    }
  }

  function removeAvatar() {
    replaceAvatarPreview('')
    setValues((current) => ({ ...current, avatarUrl: '' }))
    setRemoveAvatarOpen(false)
    setMessage('头像已移除，保存资料后生效。')
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    const response = await fetch('/api/studio/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    })
    setPending(false)
    setMessage(
      response.ok ? '资料已保存' : '保存失败，请重试。',
    )
  }

  const messageIsSuccess =
    message.startsWith('昵称已保存') ||
    message === '资料已保存' ||
    message.includes('头像上传成功') ||
    message.includes('已移除')

  return (
    <div className="studio-page max-w-[860px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Author profile</p>
          <h1>个人资料</h1>
          <p>昵称和头像会展示在公开章节的作者信息中。</p>
        </div>
      </header>

      <form className="studio-profile-form" onSubmit={save}>
        <section className="studio-profile-avatar-section">
          <AuthorAvatar
            name={values.authorName || '作者'}
            avatarUrl={avatarPreviewUrl || values.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <strong>头像</strong>
            <p>从本地选择方形图片，上传后保存资料即可生效。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="studio-secondary-button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarPending}
              >
                {avatarPending ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <ImagePlus size={18} />
                )}
                {avatarPending ? '正在上传…' : '选择本地头像'}
              </button>
              {avatarPreviewUrl || values.avatarUrl ? (
                <button
                  type="button"
                  className="studio-secondary-button hover:!text-[var(--rust)]"
                  onClick={() => setRemoveAvatarOpen(true)}
                >
                  <Trash2 size={18} />
                  移除头像
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="studio-profile-fields">
          <label className="studio-profile-field sm:col-span-2">
            <span>作者昵称</span>
            <input
              value={values.authorName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  authorName: event.target.value,
                }))
              }
              required
              maxLength={32}
            />
          </label>
        </div>

        {message ? (
          <p
            role={messageIsSuccess ? 'status' : 'alert'}
            className={
              messageIsSuccess ? 'profile-success' : 'profile-error'
            }
          >
            {message}
          </p>
        ) : null}

        <div className="studio-profile-actions">
          <button type="submit" className="studio-primary-button" disabled={pending}>
            <Save size={19} />
            {pending ? '正在保存…' : '保存资料'}
          </button>
        </div>
      </form>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="选择本地头像"
        onChange={selectAvatar}
      />

      <ConfirmDialog
        open={removeAvatarOpen}
        onOpenChange={setRemoveAvatarOpen}
        title="移除这个头像？"
        description="移除后会恢复为文字头像，保存资料后正式生效。"
        confirmLabel="移除头像"
        onConfirm={removeAvatar}
      />

      <section className="export-panel">
        <div>
          <p className="section-kicker">Portable backup</p>
          <h2>整站导出</h2>
          <p>下载分类顺序、Markdown 正文、状态、版本和协作元数据。</p>
        </div>
        <a href="/api/studio/export" download>
          下载整站导出 ZIP
        </a>
      </section>
    </div>
  )
}
