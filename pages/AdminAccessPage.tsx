import React from 'react';
import { Navigate } from 'react-router-dom';

export const AdminAccessPage: React.FC = () => <Navigate to="/admin/users" replace />;
