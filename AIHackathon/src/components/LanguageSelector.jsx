import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';

const LanguageSelector = () => {
    const { i18n } = useTranslation();

    return (
        <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="language-selector"
        >
            {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                    {lang.nativeName}
                </option>
            ))}
        </select>
    );
};

export default LanguageSelector;
