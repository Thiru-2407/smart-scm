const Footer = () => {
  return (
    <footer className="app-footer" id="app-developed-by-footer">
      <div className="footer-container">
        <div className="footer-brand-section">
          <div className="footer-brand-title">Smart SCM</div>
          <div className="footer-brand-tagline">
            Smart Software Release &amp; Version Tracking System for Configuration Management
          </div>
        </div>

        <div className="footer-divider" />

        <div className="footer-credits-section">
          <span className="credits-label">Developed by</span>
          <div className="credits-team">
            <span className="team-member">Thirukumaran K &mdash; 24MIS0471</span>
            <span className="member-separator">&bull;</span>
            <span className="team-member">Keerthivarman G &mdash; 24MIS0456</span>
            <span className="member-separator">&bull;</span>
            <span className="team-member">Azhagiri C &mdash; 24MIS0540</span>
          </div>
        </div>

        <div className="footer-copyright">
          &copy; 2026 Smart SCM
        </div>
      </div>
    </footer>
  );
};

export default Footer;
