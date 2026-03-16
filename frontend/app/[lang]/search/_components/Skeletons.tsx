export function DoctorCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        padding: '24px',
        display: 'flex',
        gap: '20px',
      }}
    >
      {/* Avatar */}
      <div className="skeleton" style={{ width: 80, height: 80, borderRadius: 'var(--r-md)', flexShrink: 0 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Name row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: '200px', height: '20px' }} />
          <div className="skeleton" style={{ width: '120px', height: '22px', borderRadius: '10px' }} />
        </div>
        <div className="skeleton" style={{ width: '260px', height: '14px' }} />

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px' }} />
          <div className="skeleton" style={{ width: '100px', height: '14px' }} />
          <div className="skeleton" style={{ width: '80px', height: '14px' }} />
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[100, 90, 110, 80].map(w => (
            <div key={w} className="skeleton" style={{ width: w, height: '26px', borderRadius: '10px' }} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton" style={{ width: '100px', height: '18px' }} />
            <div className="skeleton" style={{ width: '140px', height: '14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: 'var(--r-xl)' }} />
            <div className="skeleton" style={{ width: '90px', height: '36px', borderRadius: 'var(--r-xl)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ClinicCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {/* Image panel */}
      <div className="skeleton" style={{ width: 200, flexShrink: 0, minHeight: 160 }} />

      <div style={{ flex: 1, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="skeleton" style={{ width: '220px', height: '22px' }} />
          <div className="skeleton" style={{ width: '120px', height: '22px', borderRadius: '10px' }} />
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px' }} />
          <div className="skeleton" style={{ width: '100px', height: '14px' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[100, 90, 80, 70].map(w => (
            <div key={w} className="skeleton" style={{ width: w, height: '26px', borderRadius: '10px' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton" style={{ width: '100px', height: '18px' }} />
            <div className="skeleton" style={{ width: '120px', height: '14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: 'var(--r-xl)' }} />
            <div className="skeleton" style={{ width: '90px', height: '36px', borderRadius: 'var(--r-xl)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
