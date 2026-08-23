require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('./src/config/database');

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const officerRoutes = require('./src/routes/officers');
const leaveRoutes = require('./src/routes/leaves');
const teamRoutes = require('./src/routes/teams');
const userRoutes = require('./src/routes/users');
const documentsRouter = require('./src/routes/documents');
const onboardingRoutes = require('./src/routes/onboarding');
const rostersRouter = require('./src/routes/rosters');
const timesheetsRouter = require('./src/routes/timesheets');
const adlTasksRoutes = require('./src/routes/adl-tasks');
const settingsRoutes = require('./src/routes/settings');
const Setting = require('./src/models/Setting');
const backupRoutes = require('./src/routes/backup');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'pmcax_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/officers', officerRoutes);
app.use('/leaves', leaveRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/documents', documentsRouter);
app.use('/onboarding', onboardingRoutes);
app.use('/rosters', rostersRouter);
app.use('/timesheets', timesheetsRouter);
app.use('/adl-tasks', adlTasksRoutes);
app.use('/settings', settingsRoutes);
app.use('/backup', backupRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Không tìm thấy trang' });
});

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Kết nối MongoDB thành công');
    const require2FASetting = await Setting.findOne({ key: 'GLOBAL_2FA_ENABLED' });
    if (!require2FASetting) {
      await Setting.create({ key: 'GLOBAL_2FA_ENABLED', value: true });
      app.locals.require2FA = true;
    } else {
      app.locals.require2FA = require2FASetting.value;
    }
    app.listen(PORT, () => {
      console.log(`Server chạy tại http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));
