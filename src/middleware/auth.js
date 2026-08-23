const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    if (req.session.user.role !== 'admin' && !req.session.user.officerProfile && !req.originalUrl.startsWith('/onboarding') && !req.originalUrl.startsWith('/logout')) {
      req.flash('warning', 'Vui lòng khai báo thông tin cá nhân trước khi sử dụng hệ thống.');
      return res.redirect('/onboarding');
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
