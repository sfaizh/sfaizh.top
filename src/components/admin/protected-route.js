import React, { Component, useEffect } from "react";
import { Route, Navigate, Outlet } from "react-router-dom";
// import {auth, validate} from "./auth.js";
import { UserAuth } from '../../context/AuthContext.js';

const ProtectedRoute = ({ children }) => {
    const { user } = UserAuth();

    return user ? children : <Navigate to='/login' />;
}

export default ProtectedRoute;