import { common, createLowlight } from 'lowlight'

export const lowlight = createLowlight(common)

export const codeLanguageOptions = [
  { value: 'plaintext', label: '纯文本' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'yaml', label: 'YAML' },
] as const

export function codeLanguageLabel(language: string | null | undefined) {
  return (
    codeLanguageOptions.find((option) => option.value === language)?.label ??
    '纯文本'
  )
}
