import './App.css';

import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { Component, useEffect, useState } from "react";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";

import axios from "axios";
import deployment from "./deployment";

// Public
import Layout from './components/Layout'
import Login from "./features/auth/Login";
import About from './components/about.js';
import Home from "./components/home/home_chakra.js";

import Cars from "./components/cars/cars.js";
import Weightlifting from "./components/weightlifting/weightlifting.js";
import Industry from "./components/industry-experience/chakra_industry.js";
import Projects from './components/projects/projects.js';

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

// Datadog
import { datadogRum } from '@datadog/browser-rum'

datadogRum.init({
  applicationId: 'd94d24b8-60f8-4989-9598-78d090919cc3', 
  clientToken: 'pub55922079777aff7713ff0e54ae4d3227',
  site: 'datadoghq.com',
  service: 'sfaizh.top',
  env: 'staging-1',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input'
})

const theme = {
  breakpoints: {
    xs: "30em",
    sm: "36em",
    md: "46.25em",
    lg: "62.5em",
    xl: "78.125em",
    xxl: "95em"
  },
  components: {
    Heading: {
      baseStyle: {
        fontFamily: "inherit",
        fontWeight: "normal",
        color: "inherit"
      }
    },
    Text: {
      baseStyle: {
        fontFamily: "inherit",
        fontWeight: "normal",
        lineHeight: "tall",
        color: "inherit"
      }
    },
    Button: {
      baseStyle: {
        textTransform: "uppercase",
        letterSpacing: "wide",
        fontWeight: "normal",
        userSelect: "none"
      }
    }
  }
};

function App() {
  return (
    <ChakraProvider theme={extendTheme(theme)}>
      <ColorModeScript initialColorMode="light"></ColorModeScript>
      <div className="app-wrapper">
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* public routes */}
            <Route path="/login" element={<Login />} />
            {/* <Route path="/motorsports" element={<Cars />} /> */}
            {/* <Route path="/weightlifting" element={<Weightlifting />} /> */}
            {/* <Route path="/industry" element={<Industry />} /> */}
            <Route index element={<Home />} />
            <Route path="/:slug" element={<Blog mode={"single"} />} />
            <Route path="/blog" element={<Blog mode={"all"} />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            {/* protected routes */}
            <Route element={<PersistLogin />}>
              {/* <Route element={<Prefetch />}> */}
              <Route element={<RequireAuth allowedRoles={[...Object.values(ROLES)]} />}>
                <Route path="/_cpanel" element={<Admin />} />
                <Route path="/edit/:slug" element={<EditBlog />} />
                <Route path="/new" element={<CreateBlog />} />
              </Route>
            </Route>
          </Route>
              </Routes>
      </div>
    </ChakraProvider>

  );
}

export default App;
