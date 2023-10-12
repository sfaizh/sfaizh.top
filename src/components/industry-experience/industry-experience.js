import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from "../common/header";
import Footer from "../common/footer.js";
import Sidebar from "../common/sidebar/sidebar.js";
import Card from "../common/content/card.js";
import posts from "../../assets/data/posts.json";
import "../common/content/card.css";

let _isMounted = false;
let subCategories = ["Associate Systems Engineer", "Front-End Developer", "Web Systems Engineer", "Technical Support Specialist", "Transition & Academic Support Program Peer (TASP) Tutor"];

// Posts content industry experience
const IndustryExperience = () => {

    useEffect(()  => {
        _isMounted = true;
        return () => { _isMounted = false };
    });

    return (
        <div className="industry-wrapper">
            <div className="container-fluid header-wrapper text-center">
                <div className="row">
                    <Header current={"Industry Experience"}/>
                </div>
            </div>
            <div className="container page-wrapper p-3">
                <div className="row">
                    <div className="col-3">
                        <Sidebar options={subCategories} currCategory={"Industry Experience"} ref={React.createRef()}/>
                    </div>
                    <div className="col-9">
                        {/* Build page here */}
                        {
                            posts.posts.map(function(data, i) {
                                if (data.section == "Industry") {
                                    let x = subCategories.findIndex((y) => y === data.title)
                                    return <Card key={i} id={x} title={data.title} subtitle={data.subtitle} body={data.body} footer={data.footer} logo={data.logo} logo_size={data.logo_size} img_alt={data.img_alt} img_alt1={data.img_alt1}  img_alt2={data.img_alt2} img_alt3={data.img_alt3} img_alt4={data.img_alt4} img_alt5={data.img_alt5} />;
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

export default IndustryExperience;