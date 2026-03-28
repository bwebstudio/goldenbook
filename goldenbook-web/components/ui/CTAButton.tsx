'use client'

import { motion } from 'framer-motion'

interface CTAButtonProps {
  href: string
  variant?: 'gold' | 'outline' | 'ghost' | 'navy'
  store?: 'apple' | 'google' | null
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const GooglePlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {/* Google Play store — monochrome play triangle */}
    <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z" />
  </svg>
)

export function CTAButton({
  href,
  variant = 'gold',
  store = null,
  children,
  className = '',
  size = 'md',
}: CTAButtonProps) {
  const sizeClasses = {
    sm: 'px-5 py-2.5 text-small gap-2',
    md: 'px-7 py-3.5 text-body gap-2.5',
    lg: 'px-9 py-4 text-subtitle gap-3',
  }

  const variantClasses = {
    gold: 'bg-primary text-navy-dark hover:bg-[#C5A878] active:bg-[#B89A6A]',
    outline:
      'bg-transparent border border-ivory/25 text-ivory hover:bg-ivory/10 hover:border-ivory/40',
    ghost: 'bg-transparent text-primary hover:text-primary/80',
    navy: 'bg-navy text-ivory hover:bg-navy-light',
  }

  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={[
        'inline-flex items-center justify-center font-sans font-medium rounded-full',
        'transition-colors duration-200 cursor-pointer no-underline',
        sizeClasses[size],
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {store === 'apple' && <AppleIcon />}
      {store === 'google' && <GooglePlayIcon />}
      <span>{children}</span>
    </motion.a>
  )
}
