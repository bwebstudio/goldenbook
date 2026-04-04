import { Suspense } from 'react'
import ResetPasswordForm from './ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: '#D4B78F' }}>
            Goldenbook
          </span>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: '#FFF' }}>
            {' '}GO
          </span>
        </div>
        <div style={{
          backgroundColor: '#FFF', borderRadius: 16,
          padding: '44px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          color: '#888', fontSize: 14,
        }}>
          Loading...
        </div>
      </div>
    </div>
  )
}
