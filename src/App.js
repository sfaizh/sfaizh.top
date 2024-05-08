import './App.css';

import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { Component, useEffect, useState } from "react";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import theme from "./utils/theme.js";

import axios from "axios";
import deployment from "./deployment";

// Public
import Layout from './components/Layout'
import Login from "./features/auth/Login";
// TODO import new login
import Home from "./components/home/home_chakra.js";

import Cars from "./components/cars/cars.js";
import Weightlifting from "./components/weightlifting/weightlifting.js";
import Industry from "./components/industry-experience/chakra_industry.js";

import Blog from "./components/blog/chakra_blog.js";
import CreateBlog from "./components/admin/admin_create_blog.js";
import EditBlog from "./components/admin/admin_edit_blog.js";

// Protected
import Admin from "./components/admin/admin_chakra.js";
// import Prefetch from './features/auth/Prefetch'
import PersistLogin from './features/auth/PersistLogin'
import RequireAuth from './features/auth/RequireAuth'
import { ROLES } from './utils/config/roles'

// Misc Routes
import ProtectedRoute from "./components/admin/protected-route";
import Unauthorised from "./components/admin/unauthorised";

let config = {
  withCredentials: true,
  credentials: "include",
  headers: {
    "Accept": "*/*",
    "Content-Type": "application/json"
  }
};

function App() {
  return (
    <ChakraProvider theme={extendTheme(theme)}>
      <ColorModeScript initialColorMode="light"></ColorModeScript>
      <div className="app-wrapper">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />}/>
              {/* public routes */}
              <Route path="/blog" element={<Blog mode={"all"} />} />
              <Route path="/new" element={<CreateBlog />} />
              <Route path="/edit/:id" element={<EditBlog />} />
              <Route path="/view/:id" element={<Blog mode={"single"} />} />
              <Route path="/motorsports" element={<Cars />} />
              {/* <Route path="/weightlifting" element={<Weightlifting />} /> */}
              <Route path="/industry" element={<Industry />} />
              <Route path="/login" element={<Login />} />
              {/* protected routes */}
              <Route element={<PersistLogin />}>
                <Route element={<RequireAuth allowedRoles={[...Object.values(ROLES)]} />}>
                  {/* <Route element={<Prefetch />}> */}
                    <Route element={<RequireAuth allowedRoles={[ROLES.Manager, ROLES.Admin]} />}>
                      <Route path="/_cpanel" element={<Admin />} />
                    </Route>
                  {/* </Route> */}
                </Route>
              </Route>
            </Route>
          </Routes>
      </div>
    </ChakraProvider>

  );
}

export default App;