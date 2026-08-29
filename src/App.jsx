import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import ScrollToHash from "./components/ScrollToHash.jsx";
import Home from "./pages/Home.jsx";
import Leadership from "./pages/Leadership.jsx";
import Join from "./pages/Join.jsx";

export default function App() {
  return (
    <div className="wrap">
      <ScrollToHash />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leadership" element={<Leadership />} />
        <Route path="/join" element={<Join />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
