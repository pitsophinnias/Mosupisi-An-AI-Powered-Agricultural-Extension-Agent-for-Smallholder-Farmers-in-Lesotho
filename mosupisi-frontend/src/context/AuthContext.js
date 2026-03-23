import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../db/db';
import { useSnackbar } from 'notistack';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    // Check for saved user in localStorage
    const savedUser = localStorage.getItem('mosupisi_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (mobile, password) => {
    try {
      // Mock login - in production, this would call your API
      const farmers = await db.farmers.where('mobile').equals(mobile).toArray();
      
      if (farmers.length > 0) {
        const userData = farmers[0];
        // In real app, verify password here
        setUser(userData);
        localStorage.setItem('mosupisi_user', JSON.stringify(userData));
        enqueueSnackbar('Login successful!', { variant: 'success' });
        return { success: true, user: userData };
      } else {
        enqueueSnackbar('Invalid mobile number or password', { variant: 'error' });
        return { success: false, error: 'Invalid credentials' };
      }
    } catch (error) {
      console.error('Login error:', error);
      enqueueSnackbar('Login failed. Please try again.', { variant: 'error' });
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      // Check if user already exists
      const existing = await db.farmers.where('mobile').equals(userData.mobile).toArray();
      
      if (existing.length > 0) {
        enqueueSnackbar('User with this mobile number already exists', { variant: 'error' });
        return { success: false, error: 'User exists' };
      }

      // Add new farmer
      const id = await db.farmers.add({
        ...userData,
        createdAt: new Date().toISOString()
      });

      const newUser = { id, ...userData };
      setUser(newUser);
      localStorage.setItem('mosupisi_user', JSON.stringify(newUser));
      enqueueSnackbar('Registration successful!', { variant: 'success' });
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      enqueueSnackbar('Registration failed. Please try again.', { variant: 'error' });
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mosupisi_user');
    enqueueSnackbar('Logged out successfully', { variant: 'info' });
  };

  const updateUser = async (updates) => {
    try {
      if (user) {
        await db.farmers.update(user.id, updates);
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem('mosupisi_user', JSON.stringify(updatedUser));
        enqueueSnackbar('Profile updated successfully', { variant: 'success' });
        return { success: true };
      }
    } catch (error) {
      console.error('Update error:', error);
      enqueueSnackbar('Update failed. Please try again.', { variant: 'error' });
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};