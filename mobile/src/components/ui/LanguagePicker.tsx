import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useT, type Language } from '@/src/i18n';

const OPTIONS = LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }));

/**
 * Hungarian | English | Deutsch switch. Each language is named in itself.
 * `onChange` runs after the app language has been switched (the Account screen
 * uses it to save the choice on the account; register / login only switch the
 * language of the screen and are remembered on the device).
 */
export function LanguagePicker({ onChange }: { onChange?: (language: Language, previous: Language) => void }) {
  const { language } = useT();
  return (
    <SegmentedControl
      options={OPTIONS}
      value={language}
      onChange={(next) => {
        if (next === language) return;
        setLanguage(next);
        onChange?.(next, language);
      }}
    />
  );
}
