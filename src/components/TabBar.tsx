import { NavLink } from 'react-router-dom';
import { CameraIcon, GridIcon, MapPinIcon } from './icons';
import './TabBar.css';

const TABS = [
  { to: '/', label: 'Captura', Icon: CameraIcon, end: true },
  { to: '/galeria', label: 'Galeria', Icon: GridIcon, end: false },
  { to: '/mapa', label: 'Mapa', Icon: MapPinIcon, end: false },
];

export default function TabBar() {
  return (
    <nav className="tab-bar glass">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tab-bar__item tap-target${isActive ? ' tab-bar__item--active' : ''}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
