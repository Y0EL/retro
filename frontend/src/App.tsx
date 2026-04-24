import { Routes, Route, Navigate } from "react-router-dom"
import CommandShell from "./shell/CommandShell"
import Ikhtisar from "./pages/Ikhtisar"
import CommandCenter from "./pages/CommandCenter"
import Orkestrasi from "./pages/Orkestrasi"
import HumanInLoop from "./pages/HumanInLoop"
import OperasiAktif from "./pages/OperasiAktif"
import IntelDatabase from "./pages/IntelDatabase"
import Database from "./pages/Database"
import LookUp from "./pages/LookUp"
import Laporan from "./pages/Laporan"
import SistemHealth from "./pages/SistemHealth"
import Akun from "./pages/Akun"
import ProfilPerusahaan from "./pages/ProfilPerusahaan"

export default function App() {
  return (
    <CommandShell>
      <Routes>
        <Route path="/" element={<Ikhtisar />} />
        <Route path="/command" element={<CommandCenter />} />
        <Route path="/orkestrasi" element={<Orkestrasi />} />
        <Route path="/hitl" element={<HumanInLoop />} />
        <Route path="/operations" element={<OperasiAktif />} />
        <Route path="/intel" element={<IntelDatabase />} />
        <Route path="/database" element={<Database />} />
        <Route path="/lookup" element={<LookUp />} />
        <Route path="/laporan" element={<Laporan />} />
        <Route path="/health" element={<SistemHealth />} />
        <Route path="/akun" element={<Akun />} />
        <Route path="/profil/:id" element={<ProfilPerusahaan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CommandShell>
  )
}
