import { Training } from './pages/Training';
import { StudentAccounts } from './pages/StudentAccounts';
import { Home } from './pages/Home';
import { Schedule } from './pages/Schedule';
import { Admin, ServiceAccount } from './pages/Admin';
import './schedule.css';
import './home.css';
import { Camera } from './pages/Camera';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Protected } from './auth/RouteGuards';
import { RoleGate } from './auth/RoleGuards';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Students } from './pages/Students';
import { Rooms } from './pages/Rooms';
import { Events } from './pages/Events';

import { Status } from './pages/Status';
export function App() {
  return <Routes>
    <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
    <Route element={<Protected/>}>
      <Route element={<RoleGate roles={['student']}/> }><Route element={<Layout/>}>
        <Route index element={<Home/>}/><Route path="/schedule" element={<Schedule/>}/><Route path="/events" element={<Events/>}/>
      </Route></Route>
      <Route element={<RoleGate roles={['teacher','admin']}/> }>
        <Route path="/admin" element={<Layout/>}><Route index element={<Admin/>}/><Route path="training" element={<Training/>}/><Route path="accounts" element={<StudentAccounts/>}/><Route path="students" element={<Students/>}/><Route path="rooms" element={<Rooms/>}/><Route path="events" element={<Events/>}/><Route path="camera" element={<Camera/>}/><Route path="manual" element={<Navigate to="/admin" replace/>}/></Route>
        <Route path="/students" element={<Navigate to="/admin/students" replace/>}/><Route path="/rooms" element={<Navigate to="/admin/rooms" replace/>}/><Route path="/camera" element={<Navigate to="/admin/camera" replace/>}/><Route path="/manual" element={<Navigate to="/admin" replace/>}/>
      </Route>
      <Route element={<RoleGate roles={['ai_service']}/> }><Route path="/service" element={<ServiceAccount/>}/></Route>
    </Route>
    <Route path="*" element={<Status/>}/>
  </Routes>;
}
