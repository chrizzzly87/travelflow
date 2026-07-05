import React from 'react';
import { Navigate } from '@/lib/router';

export const AdminAccessPage: React.FC = () => <Navigate to="/admin/users" replace />;
