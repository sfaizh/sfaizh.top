import './App.css';
// import Home from "./components/home/home.js";

import Cars from "./components/cars/cars.js";
import Weightlifting from "./components/weightlifting/weightlifting.js";
// import Industry from "./components/industry-experience/industry-experience.js";

import Home from "./components/home/home_chakra.js";
import Industry from "./components/industry-experience/chakra_industry.js";


// import Blog from "./components/blog/chakra_blog.js";

import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import theme from "./utils/theme.js";

import { HashRouter, Routes, Route } from "react-router-dom";
import React, { Component, useEffect, useState } from "react";

import Blog from "./components/blog/chakra_blog.js";
import CreateBlog from "./components/admin/admin_create_blog.js";
import EditBlog from "./components/admin/admin_edit_blog.js";

import axios from "axios";
import deployment from "./deployment";

// Misc Routes
import ProtectedRoute from "./components/admin/protected-route";
import Unauthorised from "./components/admin/unauthorised";

// Protected
import Admin from "./components/admin/admin_chakra.js";

// Public
import Login from "./components/admin/login.js";
// import { AuthContextProvider } from './context/AuthContext';

let _isMounted = false;

let config = {
  withCredentials: true,
  credentials: "include",
  headers: {
    "Accept": "*/*",
    "Content-Type": "application/json"
  }
};

// Maybe put auth into its own component?

function App() {
  // const [user, setUser] = useState("");
  // const [isLoggedIn, setIsLoggedIn] = useState(false);

  // const setIsLoggedInState = user => {
  //   setIsLoggedIn(true);
  //   setUser(user);
  // };
  // const setLoggedOutState = user => {
  //   setUser("");
  //   setIsLoggedIn(false);
  // };

  // useEffect(() => {
  //   _isMounted = true;

  //   if (!isLoggedIn)
  //     getAuth();

  //   return () => { _isMounted = false };
  // }, [isLoggedIn, user]);

  // const getAuth = async () => {
  //   if (_isMounted) {
  //     const res = await axios.get(deployment.production + "/auth/user", config)
  //       .catch(err => console.log(err));
  //     if (res) {
  //       if (res.data != "No User Found") {
  //         setUser(res.data.user);
  //         setIsLoggedIn(true);
  //       } else {
  //         setUser("");
  //         setIsLoggedIn(false);
  //       }
  //     }
  //   }
  // }

  return (
    <ChakraProvider theme={extendTheme(theme)}>
      <ColorModeScript initialColorMode="light"></ColorModeScript>
      <div className="app-wrapper">
        <HashRouter basename='/portfolio'>
            <Routes>
              {/* <AuthContextProvider> */}
                <Route path="/" element={<Home />} />
                {/* <Route path="/login" element={<Login />} /> */}
                <Route path="/_cpanel" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/blog" element={<Blog mode={"all"} />} />
                <Route path="/new" element={<CreateBlog />} />
                <Route path="/edit/:id" element={<EditBlog />} />
                <Route path="/view/:id" element={<Blog mode={"single"} />} />
                <Route path="/motorsports" element={<Cars />} />
                <Route path="/weightlifting" element={<Weightlifting />} />
                <Route path="/industry" element={<Industry />} />
              {/* </AuthContextProvider> */}
            </Routes>
        </HashRouter>
      </div>
    </ChakraProvider>

  );
}

export default App;