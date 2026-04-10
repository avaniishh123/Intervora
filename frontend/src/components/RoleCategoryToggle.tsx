import '../styles/RoleCategoryToggle.css';

export type RoleCategory = 'technical' | 'non-technical';

interface Props {
  value: RoleCategory;
  onChange: (cat: RoleCategory) => void;
}

const RoleCategoryToggle = ({ value, onChange }: Props) => (
  <div className="rct-wrapper" role="group" aria-label="Role category">
    <button
      type="button"
      className={`rct-btn ${value === 'technical' ? 'rct-btn--active' : ''}`}
      onClick={() => onChange('technical')}
      aria-pressed={value === 'technical'}
    >
      <span className="rct-icon">💻</span>
      Technical
    </button>
    <button
      type="button"
      className={`rct-btn ${value === 'non-technical' ? 'rct-btn--active' : ''}`}
      onClick={() => onChange('non-technical')}
      aria-pressed={value === 'non-technical'}
    >
      <span className="rct-icon">🧠</span>
      Non-Technical
    </button>
  </div>
);

export default RoleCategoryToggle;
