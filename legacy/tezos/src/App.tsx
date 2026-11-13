import React, { useState, useRef, Component } from "react";
import { TezosToolkit } from "@taquito/taquito";
import ReactGA from 'react-ga';
import "./App.scss";
import VendingMachine from "./components/VendingMachine";

import DappCore from "./components/DappCore";

enum BeaconConnection {
  NONE = "",
  LISTENING = "Listening to P2P channel",
  CONNECTED = "Channel connected",
  PERMISSION_REQUEST_SENT = "Permission request sent, waiting for response",
  PERMISSION_REQUEST_SUCCESS = "Wallet is connected",
}

const dc = new DappCore();
const TRACKING_ID = "UA-237429285-1"; // OUR_TRACKING_ID
ReactGA.initialize(TRACKING_ID);
const App = () => {
  return (
    <div>
        <title>Vending NFTs</title>
        <meta
          name="description"
          content="An experience on the #Tezos ecosystem The first digital NFT vending machine for random art distribution."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="canonical" href="https://www.vendingnfts.xyz" />
        <meta property="og:url" content="https://www.vendingnfts.xyz" />
        <meta property="og:title" content="Vending NFTs" />
        <meta property="og:description" content="An experience on the #Tezos ecosystem The first digital NFT vending machine for random art distribution."/>
        <meta property="og:site_name" content="Vending NFTs"/>
        <meta property="og:image" content="https://vendingnfts.s3.us-east-2.amazonaws.com/cover.jpg" />
        <meta name="theme-color" content="#000000" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@tezvendmachine" />
        <meta name="twitter:creator" content="@tezvendmachine" />
        <script src="https://api.infiniteobjects.com/print-button/3391446113/client.js"></script>
 
        <script>
          window.ioPrintButton = window.ioPrintButton || [];
          window.ioPrintButton.push(["apiKey", "AIzaSyAcy407H32vzzyrA9y4ET5leQHuMmE_cWs"]);
        </script>
      <VendingMachine core={dc} />
    </div>
  );
};

export default App;
