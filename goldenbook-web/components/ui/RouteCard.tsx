'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { WebRouteDTO } from '@/lib/types'

interface RouteCardProps {
  route: WebRouteDTO
  index: number
}

export function RouteCard({ route, index }: RouteCardProps) {
  const t = useTranslations('goldenRoutes')

  return (
    <motion.a
      href="#download"
      initial={{ opacity: 0, x: 32 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative flex-shrink-0 overflow-hidden group cursor-pointer no-underline"
      style={{ width: 'clamp(300px, 38vw, 480px)', aspectRatio: '3/4' }}
    >
      {/* Background image */}
      {route.imageUrl ? (
        <Image
          src={route.imageUrl}
          alt={route.name}
          fill
          sizes="(max-width: 768px) 80vw, 38vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #222D52 0%, #161E38 100%)' }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-dark via-navy-dark/40 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-8">
        {/* Top */}
        <div className="flex items-start justify-between">
          <span className="font-sans text-ivory/50 text-caption tracking-widest">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* Bottom */}
        <div>
          <p className="eyebrow mb-3">{route.city}</p>
          <h3 className="headline-small text-ivory mb-3">{route.name}</h3>
          {route.summary && (
            <p className="font-sans text-ivory/60 text-small leading-relaxed mb-5 line-clamp-2">
              {route.summary}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4">
            {route.stops > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <span className="font-sans text-caption text-ivory/60">
                  {t('stops', { count: route.stops })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.a>
  )
}
