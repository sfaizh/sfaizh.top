import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from "../common/header";
import Footer from "../common/footer.js";
import Sidebar from "../common/sidebar/sidebar";

let _isMounted = false;
let subCategories = ["Current Progress", "Powerlifting experience"];

// Posts content weightlifting
const Weightlifting = () => {
    useEffect(()  => {
        _isMounted = true;
        return () => { _isMounted = false };
    });

    const generateSidebar = e => {
        return <Sidebar options={subCategories} currCategory={"Weightlifting"} ref={React.createRef()}/>;
    }

    return (
        <div className="weightlifting-wrapper">
            <div className="container-fluid header-wrapper text-center">
                <div className="row">
                    <Header current="Weightlifting"/>
                </div>
            </div>
            <div className="container page-wrapper p-3">
                <div className="row">
                    <div className="col-3">
                        <Sidebar options={subCategories} currCategory={"Weightlifting"} ref={React.createRef()}/>
                    </div>
                    <div className="col-9">
                        {/* Build page here */}
                        
                    </div>
                </div>
            </div>
            <div className="container-fluid footer-wrapper fixed-bottom">
                <div className="row p-3">
                    <Footer />
                </div>
            </div>
        </div>
    )
}

export default Weightlifting;