const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    if (req.session.user.mustChangePassword) {
      if (req.originalUrl !== '/onboarding/password' && !req.originalUrl.startsWith('/logout')) {
        req.flash('warning', 'Vui lòng đổi mật khẩu mặc định để bảo mật tài khoản.');
        return res.redirect('/onboarding/password');
      }
      return next();
    }

    if (req.session.user.role !== 'admin' && !req.session.user.officerProfile) {
      if (req.originalUrl !== '/onboarding' && !req.originalUrl.startsWith('/logout')) {
        req.flash('warning', 'Vui lòng khai báo thông tin cá nhân trước khi sử dụng hệ thống.');
        return res.redirect('/onboarding');
      }
      return next();
    }

    if (req.app.locals.require2FA && !req.session.user.twoFactorEnabled) {
      if (req.originalUrl !== '/onboarding/2fa' && req.originalUrl !== '/onboarding/2fa/verify' && !req.originalUrl.startsWith('/logout')) {
        req.flash('warning', 'Bắt buộc thiết lập bảo mật 2 lớp (2FA) bằng Google Authenticator.');
        return res.redirect('/onboarding/2fa');
      }
      return next();
    }

    return next();
  }
  req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Bạn không có quyền thực hiện thao tác này');
  res.redirect('/dashboard');
};

const isEditorOrAdmin = (req, res, next) => {
  if (req.session.user && ['admin', 'truong_cax', 'pho_cax'].includes(req.session.user.role)) return next();
  req.flash('error', 'Bạn không có quyền thực hiện thao tác này');
  res.redirect('/dashboard');
};

module.exports = { isAuthenticated, isAdmin, isEditorOrAdmin };
