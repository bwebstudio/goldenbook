interface EditorialBlockProps {
  eyebrow?: string
  headline: React.ReactNode
  subheadline?: string
  align?: 'left' | 'center' | 'right'
  theme?: 'light' | 'dark'
  className?: string
  children?: React.ReactNode
}

export function EditorialBlock({
  eyebrow,
  headline,
  subheadline,
  align = 'left',
  theme = 'light',
  className = '',
  children,
}: EditorialBlockProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }[align]

  const textColor = theme === 'dark' ? 'text-ivory' : 'text-ink'
  const subColor = theme === 'dark' ? 'text-ivory/60' : 'text-ink-muted/70'

  return (
    <div className={['max-w-2xl', alignClass, className].join(' ')}>
      {eyebrow && (
        <p className="eyebrow mb-4">{eyebrow}</p>
      )}
      <h2 className={['headline-section', textColor].join(' ')}>{headline}</h2>
      {subheadline && (
        <p className={['font-sans text-body mt-5 leading-relaxed', subColor].join(' ')}>
          {subheadline}
        </p>
      )}
      {children}
    </div>
  )
}
