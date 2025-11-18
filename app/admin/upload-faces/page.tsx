'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function UploadFacesPage() {
  const [memberName, setMemberName] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)

  const handleUpload = async () => {
    if (!files || !memberName) return

    setUploading(true)
    setUploadedCount(0)

    const uploadedUrls: { filename: string; url: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('memberName', memberName.toLowerCase())
      formData.append('filename', file.name)

      try {
        const response = await fetch('/api/upload-face', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          uploadedUrls.push({ filename: file.name, url: data.url })
          setUploadedCount(i + 1)
        }
      } catch (error) {
        console.error('[v0] Upload error:', error)
      }
    }

    try {
      await fetch('/api/save-face-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName: memberName.toLowerCase(),
          urls: uploadedUrls
        })
      })
    } catch (error) {
      console.error('[v0] Error saving URLs:', error)
    }

    setUploading(false)
    alert('Upload complete!')
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Upload Face Tracker Images</h1>
        
        <div className="space-y-6 bg-zinc-900 p-6 rounded-lg">
          <div>
            <Label htmlFor="memberName">Member Name</Label>
            <Input
              id="memberName"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. dave, sarah, john"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="files">Face Tracker Images (all 122 files)</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(e.target.files)}
              className="mt-2"
            />
            {files && (
              <p className="text-sm text-zinc-400 mt-2">
                {files.length} files selected
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!files || !memberName || uploading}
            className="w-full"
          >
            {uploading
              ? `Uploading... ${uploadedCount}/${files?.length || 0}`
              : 'Upload to Vercel Blob'}
          </Button>

          <div className="text-sm text-zinc-400 space-y-2">
            <p>Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter the member's name (lowercase)</li>
              <li>Select all 122 face_looker images at once</li>
              <li>Click upload - images will be stored in Vercel Blob</li>
              <li>The face tracker will automatically use the uploaded images</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
