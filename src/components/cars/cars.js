import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from "../common/header";
import Footer from "../common/footer.js";
import Sidebar from "../common/sidebar/sidebar";
import Card from "../common/content/card.js";
import posts from "../../assets/data/posts.json";
import "../cars/cars.css";

let _isMounted = false;
let subCategories = ["Honda Integra DC5 06 K24 Swapped", "Honda Civic FN2R 06", "Mazda MX-5 NC 07"];
let subCategories2 = ["Current Progress", "Powerlifting experience"];
let subCategories3 = ["New Columbo/ImmerQi Abroad experience Beijing, China", "Trip to Karbala", "Trip to Pakistan"];
let subCategories4 = ["Front-end Developer WPIC, China", "Web Systems Engineer Boulvandre", "Technical Support Specialist, Bossco Auto"];

// Posts content cars
const Cars = () => {

    useEffect(()  => {
        _isMounted = true;
        return () => { _isMounted = false };
    });

    return (
        <div className="cars-wrapper">
            <div className="container-fluid header-wrapper text-center">
                <div className="row">
                    <Header current={"Cars"}/>
                </div>
            </div>
            <div className="container page-wrapper p-3">
                <div className="row">
                    <div className="col-3">
                        <Sidebar options={subCategories} currCategory={"Motorsports"} ref={React.createRef()}/>
                    </div>
                    <div className="col-9">
                        {/* Build page here */}
                        {
                            posts.posts.map(function(data, i) {
                                if (data.section == "Motorsports") {
                                    // This needs to be talking to the sidebar
                                    // Map subCategories id to Card
                                    let x = subCategories.findIndex((y) => y === data.title)
                                    return <Card key={i} id={x} title={data.title} subtitle={data.subtitle} body={data.body} footer={data.footer} logo={data.logo} logo_size={data.logo_size} img_alt={data.img_alt} img_alt1={data.img_alt1} img_alt2={data.img_alt2} img_alt3={data.img_alt3} img_alt4={data.img_alt4} img_alt5={data.img_alt5} />;
                                }
                            })
                        }
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

export default Cars;