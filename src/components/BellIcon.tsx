import React from 'react';

interface BellIconProps {
  hasUnread: boolean;
}

const BellIcon: React.FC<BellIconProps> = ({ hasUnread }) => (
    <>
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.489 6.05067V5.60482C10.489 3.15681 8.57696 1.1723 6.21835 1.1723C3.85975 1.1723 1.94772 3.15681 1.94772 5.60482V6.05067C1.94772 6.58574 1.79512 7.10883 1.50916 7.55402L0.80841 8.645C0.168343 9.64149 0.656981 10.996 1.77022 11.3111C4.68246 12.1355 7.75425 12.1355 10.6665 11.3111C11.7797 10.996 12.2684 9.64149 11.6283 8.645L10.9275 7.55402C10.6416 7.10883 10.489 6.58574 10.489 6.05067Z" stroke="#8F8F8F" strokeWidth="0.949153"/>
    </svg>
    {hasUnread && (
      <span
        style={{
          position: 'absolute',
          top: 1,
          right: 1,
          width: 9,
          height: 9,
          background: 'red',
          borderRadius: '50%',
          border: '1.5px solid white',
          display: 'block',
        }}
      />
    )}
    </>
);

export default BellIcon;
