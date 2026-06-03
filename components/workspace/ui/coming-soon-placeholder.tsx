import React from 'react'
import { Hammer } from 'lucide-react'

export function ComingSoonPlaceholder({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-nx-elevated rounded-full flex items-center justify-center mb-6 border border-nx-border">
        <Hammer className="w-8 h-8 text-nx-cyan" />
      </div>
      <h1 className="text-2xl font-bold text-nx-text mb-2 font-ui">
        {moduleName} Coming Soon
      </h1>
      <p className="text-nx-text-sec max-w-md mx-auto text-sm leading-relaxed">
        We are currently upgrading the {moduleName} module to align with our new canonical schema. This feature will be available shortly.
      </p>
    </div>
  )
}
