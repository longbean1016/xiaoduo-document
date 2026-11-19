import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthorAvatar } from '../../components/AuthorAvatar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { compressAvatarFile } from '../../lib/images'
import { usePageTitle } from '../../lib/usePageTitle'
import { useSiteStore } from '../../store/siteStore'

export function StudioSettingsPage() {
  usePageTitle('个人资料 · 知笺')
  const author = useSiteStore((state) => state.author)
  const updateAuthor = useSiteStore((state) => state.updateAuthor)
  const [name, setName] = useState(author.name)
  const [avatarUrl, setAvatarUrl] = useState(author.avatarUrl ?? '')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [removeAvatarOpen, setRemoveAvatarOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('昵称不能为空')
      return
    }
    updateAuthor({ name: name.trim(), avatarUrl })
    setName(name.trim())
    toast.success('个人资料已保存')
  }

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarBusy(true)
    try {
      const avatar = await compressAvatarFile(file)
      setAvatarUrl(avatar.dataUrl)
      toast.success('头像已准备好，保存资料后生效')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像处理失败')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="studio-page max-w-[860px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Author profile</p>
          <h1>个人资料</h1>
          <p>昵称和头像会展示在公开章节的作者信息中。</p>
        </div>
      </header>

      <form onSubmit={submit} className="studio-profile-form">
        <section className="studio-profile-avatar-section">
          <AuthorAvatar
            name={name || author.name}
            avatarUrl={avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <strong>头像</strong>
            <p>从本地选择方形图片。对象存储接入前仅显示临时预览。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="studio-secondary-button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
              >
                {avatarBusy ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <ImagePlus size={18} />
                )}
                选择本地头像
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="studio-secondary-button hover:!text-[var(--rust)]"
                  onClick={() => setRemoveAvatarOpen(true)}
                >
                  <Trash2 size={18} />
                  移除头像
                </button>
              )}
            </div>
          </div>
        </section>

        <label className="studio-profile-field sm:col-span-2">
          <span>昵称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={32}
            placeholder="你的昵称"
          />
          <small>最多 32 个字符，会显示在公开章节中。</small>
        </label>

        <div className="studio-profile-actions">
          <button type="submit" className="studio-primary-button">
            <Save size={19} />
            保存资料
          </button>
        </div>
      </form>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={uploadAvatar}
      />

      <ConfirmDialog
        open={removeAvatarOpen}
        onOpenChange={setRemoveAvatarOpen}
        title="移除这个头像？"
        description="移除后会恢复为文字头像，保存资料后正式生效。"
        confirmLabel="移除头像"
        onConfirm={() => {
          setAvatarUrl('')
          setRemoveAvatarOpen(false)
        }}
      />
    </div>
  )
}
