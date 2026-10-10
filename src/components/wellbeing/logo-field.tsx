'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { logoFromFile } from '@/lib/wellbeing/logo-file';
import type { LogoUpload } from '@/lib/wellbeing/groups-api';

/** File picker for a group logo: reports the validated upload (and a preview URL) or an error message. */
export function LogoPickerButton({
  onPicked,
  onError,
}: {
  onPicked: (upload: LogoUpload, previewSrc: string) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Logo file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const picked = await logoFromFile(file);
          if (!picked.ok) return onError(picked.message);
          onPicked(picked.upload, `data:${picked.upload.contentType};base64,${picked.upload.dataBase64}`);
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
        Choose a logo
      </Button>
    </>
  );
}
