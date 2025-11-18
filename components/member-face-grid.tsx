'use client'

import { FaceTracker } from './face-tracker'

interface Member {
  id: string
  name: string
  faceFolder: string
}

interface MemberFaceGridProps {
  members: Member[]
}

export function MemberFaceGrid({ members }: MemberFaceGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {members.map((member) => (
        <div key={member.id} className="group">
          <div className="w-full aspect-square mb-3">
            <FaceTracker memberFolder={member.faceFolder} size={256} />
          </div>
          <p className="text-center font-semibold text-foreground group-hover:text-primary transition-colors">
            {member.name}
          </p>
        </div>
      ))}
    </div>
  )
}
