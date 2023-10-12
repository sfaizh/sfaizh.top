import axios from "axios";
import deployment from "../../deployment.json";
import React, { Component, useEffect, useState } from "react";

export async function auth(user) {
    let config = {
        withCredentials: true,
        credentials: "include",
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        }
    };

    const res = await axios.post(deployment.production + "/auth/login", user, config)
        .catch(err => console.log(err));
    if (res) {
        if (res.data != "No User Found") {
            return res.data.user;
        } else {
            return "Wrong Username or Password";
        }
    }
}

export async function register(user) {
    let config = {
        withCredentials: true,
        credentials: "include",
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        }
    };

    const res = await axios.post(deployment.production + "/auth/register", user, config)
        .catch(err => console.log(err));
    if (res) {
        return res;
    }
}

export async function validate() {
    let config = {
        withCredentials: true,
        credentials: "include",
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        }
    };

    const res = await axios.get(deployment.production + "/auth/user", config)
        .catch(err => console.log(err));
    if (res) {
        if (res.data != "No User Found") {
            return res.data.user;
        } else {
            return false;
        }
    }
}

export async function logout() {
    let config = {
        withCredentials: true,
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        }
    };

    const res = await axios.post(deployment.production + "/auth/logout", {}, config)
        .catch(err => console.log(err));
    if (res) {
        return res;
    }
}