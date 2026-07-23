import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fetchLatestTarballUrl, downloadTarball } from "../utils/npm";
import { copyTemplate } from "../utils/copier";
import { findProjectRoot, exists } from "../utils/fs";
import { installPackage } from "../utils/installer";

export const extensions = {
  mail: "@skalfa/mail",
  redis: "@skalfa/skalfa-redis",
  queue: "@skalfa/skalfa-queue",
  cache: "@skalfa/skalfa-cache",
  cron: "@skalfa/skalfa-cron",
  da: "@skalfa/skalfa-da",
  socket: "@skalfa/skalfa-socket",
  orm: "@skalfa/skalfa-orm",
  lang: "@skalfa/skalfa-lang"
} as const;

export const frontendExtensions = ["idb", "socket", "document", "pwa", "tauri-desktop", "tauri-mobile", "lang", "printer", "odb"];
export const extensionNames = Array.from(new Set([...Object.keys(extensions), ...frontendExtensions]));

export async function addExtension(extensionName: string): Promise<void> {
  const projectRoot = findProjectRoot(process.cwd());

  if (!projectRoot) {
    throw new Error("No package.json found. Run this command inside a Skalfa project.");
  }

  // Detect project type by checking package.json dependencies
  const packageJsonPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const isFrontend = pkg.dependencies && pkg.dependencies["next"];

  if (isFrontend) {
    if (!frontendExtensions.includes(extensionName)) {
      throw new Error(
        `Unknown frontend extension "${extensionName}". Available frontend extensions: ${frontendExtensions.join(", ")}`
      );
    }

    const isDev = !!process.env["SKALFA_APP_TEMPLATE"];

    if (extensionName === "idb") {
      console.log("Installing Skalfa IndexedDB extension...");
      installPackage(projectRoot, isDev ? "file:../skalfa-idb" : "@skalfa/skalfa-idb");
      addTsconfigPath(path.join(projectRoot, "tsconfig.json"), "@skalfa/skalfa-idb");
      addUtilExport(path.join(projectRoot, "utils", "index.ts"), "@skalfa/skalfa-idb");

      // Scaffold IDBProvider
      console.log("Scaffolding IDBProvider...");
      const providerDir = path.join(projectRoot, "components", "base.components", "wrap");
      if (!fs.existsSync(providerDir)) {
        fs.mkdirSync(providerDir, { recursive: true });
      }
      const providerPath = path.join(providerDir, "IDBProvider.tsx");
      const providerContent = `"use client"

import { useEffect } from "react"
import { idb } from "@skalfa/skalfa-idb"
import { AppSchema } from "@schema"
import { registry } from "@utils"

export function IDBProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    idb.setDefaultSchema(AppSchema);
    registry.register("idb", idb);
  }, []);

  return <>{children}</>
}
`;
      fs.writeFileSync(providerPath, providerContent, "utf8");
      console.log(`Created: ${providerPath}`);

      // Scaffold app.schema.ts
      console.log("Scaffolding AppSchema...");
      const schemaDir = path.join(projectRoot, "schema", "idb");
      if (!fs.existsSync(schemaDir)) {
        fs.mkdirSync(schemaDir, { recursive: true });
      }
      const schemaPath = path.join(schemaDir, "app.schema.ts");
      const schemaContent = `import { DBSchema } from "@skalfa/skalfa-idb"

const name  =  String(process.env.NEXT_PUBLIC_APP_NAME || "").toLowerCase().trim().replace(/[^\\w\\s-]/g, "").replace(/[\\s_-]+/g, "-").replace(/^-+|-+$/g, "") + ".idb-app";

export const AppSchema: DBSchema = {
  name: name,
  version: 1,
  stores: {}
}
`;
      fs.writeFileSync(schemaPath, schemaContent, "utf8");
      console.log(`Created: ${schemaPath}`);

      // Ensure schema/index.ts exists so the @schema alias works
      const schemaIndexPath = path.join(projectRoot, "schema", "index.ts");
      if (!fs.existsSync(schemaIndexPath)) {
        fs.writeFileSync(schemaIndexPath, `export * from "./idb/app.schema";\n`, "utf8");
        console.log(`Created: ${schemaIndexPath}`);
      }

      // Update app/layout.tsx
      console.log("Updating app/layout.tsx...");
      const layoutPath = path.join(projectRoot, "app", "layout.tsx");
      if (fs.existsSync(layoutPath)) {
        let layoutContent = fs.readFileSync(layoutPath, "utf8");
        
        // 1. Add IDBProvider to import
        if (layoutContent.includes('import { ShortcutProvider } from "@components";')) {
          layoutContent = layoutContent.replace(
            'import { ShortcutProvider } from "@components";',
            'import { IDBProvider, ShortcutProvider } from "@components";'
          );
        } else if (layoutContent.includes('import { ShortcutProvider } from "@components"')) {
          layoutContent = layoutContent.replace(
            'import { ShortcutProvider } from "@components"',
            'import { IDBProvider, ShortcutProvider } from "@components"'
          );
        }
        
        // 2. Wrap {children} with <IDBProvider>
        if (layoutContent.includes("{children}") && !layoutContent.includes("<IDBProvider>")) {
          layoutContent = layoutContent.replace(
            /\{\s*children\s*\}/,
            `<IDBProvider>\n            {children}\n          </IDBProvider>`
          );
        }
        
        fs.writeFileSync(layoutPath, layoutContent, "utf8");
        console.log(`Updated: ${layoutPath}`);
      }
    } else if (extensionName === "socket") {
      console.log("Installing Skalfa Socket.io client extension...");
      installPackage(projectRoot, isDev ? "file:../skalfa-socket-client" : "@skalfa/skalfa-socket-client");
      installPackage(projectRoot, "socket.io-client");
      addTsconfigPath(path.join(projectRoot, "tsconfig.json"), "@skalfa/skalfa-socket-client");
      addUtilExport(path.join(projectRoot, "utils", "index.ts"), "@skalfa/skalfa-socket-client");
    } else if (extensionName === "document") {
      console.log("Installing Skalfa Document export extension...");
      installPackage(projectRoot, isDev ? "file:../skalfa-document" : "@skalfa/skalfa-document");
      installPackage(projectRoot, "exceljs");
      installPackage(projectRoot, "pdf-lib");
      installPackage(projectRoot, "pdfjs-dist");
      addTsconfigPath(path.join(projectRoot, "tsconfig.json"), "@skalfa/skalfa-document");
      addUtilExport(path.join(projectRoot, "utils", "index.ts"), "@skalfa/skalfa-document");

      // Copy public worker
      console.log("Scaffolding pdf worker file...");
      const { templateSource, cleanup } = await getAppTemplateSource(projectRoot);
      try {
        const workerSrc = path.join(templateSource, "public", "pdf.worker.min.mjs");
        const workerDest = path.join(projectRoot, "public", "pdf.worker.min.mjs");
        if (exists(workerSrc)) {
          fs.mkdirSync(path.dirname(workerDest), { recursive: true });
          fs.copyFileSync(workerSrc, workerDest);
        }
      } finally {
        cleanup();
      }

      // Add exports back to components/base.components/index.ts to keep @components compatibility
      const baseComponentsIndexPath = path.join(projectRoot, "components", "base.components", "index.ts");
      if (fs.existsSync(baseComponentsIndexPath)) {
        let content = fs.readFileSync(baseComponentsIndexPath, "utf8");
        if (!content.includes("@skalfa/skalfa-document")) {
          content += `\nexport * from "@skalfa/skalfa-document";\n`;
          fs.writeFileSync(baseComponentsIndexPath, content, "utf8");
        }
      }
    } else if (extensionName === "pwa") {
      console.log("Installing Skalfa PWA extension...");
      installPackage(projectRoot, "@ducanh2912/next-pwa");

      // Copy manifest.ts from template if it doesn't exist
      const manifestPath = path.join(projectRoot, "app", "manifest.ts");
      if (!fs.existsSync(manifestPath)) {
        console.log("Scaffolding PWA manifest file...");
        const { templateSource, cleanup } = await getAppTemplateSource(projectRoot);
        try {
          const manifestSrc = path.join(templateSource, "app", "manifest.ts");
          if (exists(manifestSrc)) {
            fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
            fs.copyFileSync(manifestSrc, manifestPath);
          }
        } finally {
          cleanup();
        }
      }

      // Wrap next.config.ts with withPWA
      const nextConfigPath = path.join(projectRoot, "next.config.ts");
      if (fs.existsSync(nextConfigPath)) {
        let content = fs.readFileSync(nextConfigPath, "utf8");
        if (!content.includes("@ducanh2912/next-pwa")) {
          content = `import withPWAInit from "@ducanh2912/next-pwa";\n` + content;
          content = content.replace(
            /export default nextConfig;/,
            `const withPWA = withPWAInit({\n  dest: "public",\n  disable: process.env.NODE_ENV === "development",\n});\n\nexport default withPWA(nextConfig);`
          );
          fs.writeFileSync(nextConfigPath, content, "utf8");
        }
      }
    } else if (extensionName === "tauri-desktop" || extensionName === "tauri-mobile") {
      console.log(`Installing Skalfa ${extensionName === "tauri-desktop" ? "Tauri Desktop" : "Tauri Mobile"} extension...`);
      installPackage(projectRoot, "@tauri-apps/api");
      installPackage(projectRoot, "@tauri-apps/cli", true); // devDependency
      installPackage(projectRoot, "cross-env", true);       // devDependency

      // Copy src-tauri folder
      console.log("Scaffolding Tauri configuration...");
      const tauriDest = path.join(projectRoot, "src-tauri");
      if (!fs.existsSync(tauriDest)) {
        const { templateSource, cleanup } = await getAppTemplateSource(projectRoot);
        try {
          const tauriSrc = path.join(templateSource, "src-tauri");
          if (exists(tauriSrc)) {
            copyTemplate(tauriSrc, tauriDest);
          }
        } finally {
          cleanup();
        }
      }

      // Add scripts to package.json
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts["tauri"] = "cross-env IS_TAURI=true tauri";
        if (extensionName === "tauri-mobile") {
          pkg.scripts["tauri:android"] = "cross-env IS_TAURI=true tauri android";
          pkg.scripts["tauri:ios"] = "cross-env IS_TAURI=true tauri ios";
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
      }
    } else if (extensionName === "lang") {
        console.log("Installing Skalfa Lang extension for frontend...");
        installPackage(projectRoot, isDev ? "file:../skalfa-lang" : "@skalfa/skalfa-lang");

        console.log("Scaffolding lang.config.ts...");
        const configPath = path.join(projectRoot, "lang.config.ts");
        if (!fs.existsSync(configPath)) {
          const configContent = `import { defineConfig } from "@skalfa/skalfa-lang";

export default defineConfig({
  defaultLocale: "id",
  locales: ["id", "en"],
  frontend: {
    global: "langs",
    modules: "src/app/**/_langs"
  },
  output: "langs/.generated"
});
`;
          fs.writeFileSync(configPath, configContent, "utf8");
        }

        console.log("Scaffolding sample frontend locale files...");
        const globalLangsIdDir = path.join(projectRoot, "langs", "id");
        const globalLangsEnDir = path.join(projectRoot, "langs", "en");
        fs.mkdirSync(globalLangsIdDir, { recursive: true });
        fs.mkdirSync(globalLangsEnDir, { recursive: true });

        const idBase = {
          appName: "Aplikasi Skalfa",
          welcomeTitle: "Selamat Datang di Skalfa",
          welcomeSubtitle: "Mulailah membangun aplikasi modern Anda",
          modalDeleteTitle: "Yakin ingin menghapus {data}?",
          modalDeleteDescription: "{data} yang dihapus tidak dapat dikembalikan.",
          save: "Simpan",
          cancel: "Batal",
          delete: "Hapus",
          add: "Tambah",
          edit: "Ubah",
          detail: "Detail",
          print: "Cetak",
          import: "Import",
          export: "Export",
          importFromExcel: "Import Dari Excel",
          exportToExcel: "Export Ke Excel",
          addData: "Tambah Data",
          editData: "Ubah Data",
          deleteData: "Menghapus Data?",
          confirmDelete: "Yakin menghapus \"{data}\"?",
          confirmDeleteDescription: "Yakin yang dihapus sudah benar?",
          confirmAction: "Yakin melakukan aksi untuk data \"{data}\"?",
          confirmActionDescription: "Yakin aksi yang dilakukan sudah benar?",
          actionData: "{action} Data?",
          newShortcut: "Tambah Data Baru",
          importShortcut: "Import Data Dari Excel",
          exportShortcut: "Export Data Ke Excel",
          confirmTitle: "Konfirmasi",
          confirmFormDescription: "Yakin semua data sudah benar?",
          success: "Berhasil",
          failed: "Gagal",
          successDescription: "Data berhasil disimpan!",
          failedDescription: "Data gagal disimpan, cek data dan koneksi internet lalu coba kembali!"
        };

        const enBase = {
          appName: "Skalfa Application",
          welcomeTitle: "Welcome to Skalfa",
          welcomeSubtitle: "Start building your modern application",
          modalDeleteTitle: "Are you sure you want to delete {data}?",
          modalDeleteDescription: "Deleted {data} cannot be recovered.",
          save: "Save",
          cancel: "Cancel",
          delete: "Delete",
          add: "Add",
          edit: "Edit",
          detail: "Detail",
          print: "Print",
          import: "Import",
          export: "Export",
          importFromExcel: "Import From Excel",
          exportToExcel: "Export To Excel",
          addData: "Add Data",
          editData: "Edit Data",
          deleteData: "Delete Data?",
          confirmDelete: "Are you sure you want to delete \"{data}\"?",
          confirmDeleteDescription: "Are you sure the deleted data is correct?",
          confirmAction: "Are you sure you want to perform the action for \"{data}\"?",
          confirmActionDescription: "Are you sure the action is correct?",
          actionData: "{action} Data?",
          newShortcut: "Add New Data",
          importShortcut: "Import Data From Excel",
          exportShortcut: "Export Data To Excel",
          confirmTitle: "Confirmation",
          confirmFormDescription: "Are you sure all data is correct?",
          success: "Success",
          failed: "Failed",
          successDescription: "Data saved successfully!",
          failedDescription: "Failed to save data, please check your data and internet connection then try again!"
        };

        const idValidation = {
          required: "Kolom ini wajib diisi!",
          min: "Kolom harus berisi lebih dari {min} karakter!",
          max: "Kolom harus kurang dari {max} karakter!",
          min_max: "Kolom harus berisi antara {min} - {max} karakter!",
          phone: "Silakan masukkan nomor telepon yang valid!",
          url: "Silakan masukkan URL yang valid!",
          uppercase: "Kolom harus mengandung minimal 1 huruf besar!",
          lowercase: "Kolom harus mengandung minimal 1 huruf kecil!",
          numeric: "Kolom harus mengandung minimal 1 angka!",
          email: "Silakan masukkan alamat email yang valid!",
          in: "Kolom harus berupa salah satu dari: {keywords}!",
          not_in: "Kolom tidak boleh berupa salah satu dari: {keywords}!",
          regex: "Silakan masukkan format yang valid!",
          invalid_file_type: "Hanya memperbolehkan ekstensi {extension}!",
          max_file_size: "Ukuran file maksimum {maxFileSize} Mb!"
        };

        const enValidation = {
          required: "Please fill in this field!",
          min: "Field must contain more than {min} characters!",
          max: "Field must be less than {max} characters!",
          min_max: "Field must be {min} - {max} characters!",
          phone: "Please enter a valid mobile number!",
          url: "Please enter a valid URL!",
          uppercase: "Field must contain at least 1 uppercase letter!",
          lowercase: "Field must contain at least 1 lowercase letter!",
          numeric: "Field must contain at least 1 number!",
          email: "Please enter a valid email address!",
          in: "Field must be one of: {keywords}!",
          not_in: "Field cannot be one of: {keywords}!",
          regex: "Please enter a valid format!",
          invalid_file_type: "Only extensions {extension} are allowed!",
          max_file_size: "Maximum file size is {maxFileSize} Mb!"
        };

        fs.writeFileSync(path.join(globalLangsIdDir, "base.json"), JSON.stringify(idBase, null, 2), "utf8");
        fs.writeFileSync(path.join(globalLangsEnDir, "base.json"), JSON.stringify(enBase, null, 2), "utf8");
        fs.writeFileSync(path.join(globalLangsIdDir, "validation.json"), JSON.stringify(idValidation, null, 2), "utf8");
        fs.writeFileSync(path.join(globalLangsEnDir, "validation.json"), JSON.stringify(enValidation, null, 2), "utf8");

        const pkgPath = path.join(projectRoot, "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          pkg.scripts = pkg.scripts || {};
          pkg.scripts["lang:build"] = "skalfa lang build";
          pkg.scripts["lang:dev"] = "skalfa lang dev";
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
        }
      } else if (extensionName === "printer" || extensionName === "odb") {
        const extensionTitle = extensionName === "printer" ? "Printer" : "ODB";
        const packageName = extensionName === "printer" ? "@skalfa/skalfa-printer" : "@skalfa/skalfa-odb";
        const localPath = extensionName === "printer" ? "file:../skalfa-printer" : "file:../skalfa-odb";

        const tauriDest = path.join(projectRoot, "src-tauri");
        if (!fs.existsSync(tauriDest)) {
          console.log(`Extension "${extensionName}" requires Tauri. Automatically installing tauri-desktop extension first...`);
          await addExtension("tauri-desktop");
        }

        console.log(`Installing Skalfa ${extensionTitle} extension...`);
        installPackage(projectRoot, isDev ? localPath : packageName);
        addTsconfigPath(path.join(projectRoot, "tsconfig.json"), packageName);
        addUtilExport(path.join(projectRoot, "utils", "index.ts"), packageName);

        // Update src-tauri/Cargo.toml
        const tauriCargoPath = path.join(projectRoot, "src-tauri", "Cargo.toml");
        if (fs.existsSync(tauriCargoPath)) {
          let cargoContent = fs.readFileSync(tauriCargoPath, "utf8");
          const pluginCrateName = extensionName === "printer" ? "tauri-plugin-skalfa-printer" : "tauri-plugin-skalfa-odb";
          const pluginPath = isDev
            ? (extensionName === "printer" ? "../../skalfa-printer/src-rust" : "../../skalfa-odb/src-rust")
            : (extensionName === "printer" ? "../node_modules/@skalfa/skalfa-printer/src-rust" : "../node_modules/@skalfa/skalfa-odb/src-rust");
          
          if (!cargoContent.includes(pluginCrateName)) {
            cargoContent += `\n${pluginCrateName} = { path = "${pluginPath}" }\n`;
            fs.writeFileSync(tauriCargoPath, cargoContent, "utf8");
            console.log(`Updated: ${tauriCargoPath}`);
          }
        }

        // Update src-tauri/src/main.rs
        const tauriMainPath = path.join(projectRoot, "src-tauri", "src", "main.rs");
        if (fs.existsSync(tauriMainPath)) {
          let mainContent = fs.readFileSync(tauriMainPath, "utf8");
          const pluginFn = extensionName === "printer" ? "tauri_plugin_skalfa_printer::init()" : "tauri_plugin_skalfa_odb::init()";
          if (!mainContent.includes(pluginFn)) {
            mainContent = mainContent.replace(
              /tauri::Builder::default\(\)/,
              `tauri::Builder::default()\n        .plugin(${pluginFn})`
            );
            fs.writeFileSync(tauriMainPath, mainContent, "utf8");
            console.log(`Updated: ${tauriMainPath}`);
          }
        }
      }

    console.log(`✓ Frontend extension "${extensionName}" successfully installed and configured.`);
    return;
  }

  // Backend scaffolding logic
  const packageName = extensions[extensionName as keyof typeof extensions];

  if (!packageName) {
    throw new Error(
      `Unknown backend extension "${extensionName}". Available extensions: ${extensionNames.join(", ")}`
    );
  }

  const isDev = !!process.env["SKALFA_API_TEMPLATE"];

  if (extensionName === "orm") {
    console.log("Installing Skalfa ORM and database dependencies...");
    installPackage(projectRoot, isDev ? "file:../skalfa-orm" : "@skalfa/skalfa-orm");
    installPackage(projectRoot, "knex");
    installPackage(projectRoot, "pg");
    await scaffoldOrmExtension(projectRoot);
  } else if (["redis", "queue", "cache", "cron", "da", "socket"].includes(extensionName)) {
    console.log(`Installing Skalfa extension: ${extensionName}...`);
    
    // Install the main package
    installPackage(projectRoot, isDev ? `file:../${packageName.split("/")[1]}` : packageName);

    // Install peer dependencies if any
    if (extensionName === "redis") {
      installPackage(projectRoot, "ioredis");
    } else if (extensionName === "da") {
      installPackage(projectRoot, "@clickhouse/client");
    } else if (extensionName === "socket") {
      installPackage(projectRoot, "socket.io");
    }

    // Auto-install Redis if Queue or Cache is added
    if (extensionName === "queue" || extensionName === "cache") {
      console.log(`Extension ${extensionName} requires Redis. Automatically installing @skalfa/skalfa-redis...`);
      installPackage(projectRoot, isDev ? "file:../skalfa-redis" : "@skalfa/skalfa-redis");
      installPackage(projectRoot, "ioredis");
    }

      await scaffoldUtilityExtension(projectRoot, extensionName);
    } else if (extensionName === "lang") {
      console.log("Installing Skalfa Lang extension for backend...");
      installPackage(projectRoot, isDev ? "file:../skalfa-lang" : "@skalfa/skalfa-lang");

      console.log("Scaffolding lang.config.ts...");
      const configPath = path.join(projectRoot, "lang.config.ts");
      if (!fs.existsSync(configPath)) {
        const configContent = `import { defineConfig } from "@skalfa/skalfa-lang";

export default defineConfig({
  defaultLocale: "id",
  locales: ["id", "en"],
  backend: {
    path: "langs"
  },
  output: "langs/.generated"
});
`;
        fs.writeFileSync(configPath, configContent, "utf8");
      }

      console.log("Scaffolding sample backend locale files...");
      const langsIdDir = path.join(projectRoot, "langs", "id");
      const langsEnDir = path.join(projectRoot, "langs", "en");
      fs.mkdirSync(langsIdDir, { recursive: true });
      fs.mkdirSync(langsEnDir, { recursive: true });

      const idBase = {
        appName: "Aplikasi Skalfa",
        welcomeTitle: "Selamat Datang di Skalfa",
        welcomeSubtitle: "Mulailah membangun aplikasi modern Anda",
        modalDeleteTitle: "Yakin ingin menghapus {data}?",
        modalDeleteDescription: "{data} yang dihapus tidak dapat dikembalikan.",
        save: "Simpan",
        cancel: "Batal",
        delete: "Hapus",
        add: "Tambah",
        edit: "Ubah",
        detail: "Detail",
        print: "Cetak",
        import: "Import",
        export: "Export",
        importFromExcel: "Import Dari Excel",
        exportToExcel: "Export Ke Excel",
        addData: "Tambah Data",
        editData: "Ubah Data",
        deleteData: "Menghapus Data?",
        confirmDelete: "Yakin menghapus \"{data}\"?",
        confirmDeleteDescription: "Yakin yang dihapus sudah benar?",
        confirmAction: "Yakin melakukan aksi untuk data \"{data}\"?",
        confirmActionDescription: "Yakin aksi yang dilakukan sudah benar?",
        actionData: "{action} Data?",
        newShortcut: "Tambah Data Baru",
        importShortcut: "Import Data Dari Excel",
        exportShortcut: "Export Data Ke Excel",
        confirmTitle: "Konfirmasi",
        confirmFormDescription: "Yakin semua data sudah benar?",
        success: "Berhasil",
        failed: "Gagal",
        successDescription: "Data berhasil disimpan!",
        failedDescription: "Data gagal disimpan, cek data dan koneksi internet lalu coba kembali!"
      };

      const enBase = {
        appName: "Skalfa Application",
        welcomeTitle: "Welcome to Skalfa",
        welcomeSubtitle: "Start building your modern application",
        modalDeleteTitle: "Are you sure you want to delete {data}?",
        modalDeleteDescription: "Deleted {data} cannot be recovered.",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        add: "Add",
        edit: "Edit",
        detail: "Detail",
        print: "Print",
        import: "Import",
        export: "Export",
        importFromExcel: "Import From Excel",
        exportToExcel: "Export To Excel",
        addData: "Add Data",
        editData: "Edit Data",
        deleteData: "Delete Data?",
        confirmDelete: "Are you sure you want to delete \"{data}\"?",
        confirmDeleteDescription: "Are you sure the deleted data is correct?",
        confirmAction: "Are you sure you want to perform the action for \"{data}\"?",
        confirmActionDescription: "Are you sure the action is correct?",
        actionData: "{action} Data?",
        newShortcut: "Add New Data",
        importShortcut: "Import Data From Excel",
        exportShortcut: "Export Data To Excel",
        confirmTitle: "Confirmation",
        confirmFormDescription: "Are you sure all data is correct?",
        success: "Success",
        failed: "Failed",
        successDescription: "Data saved successfully!",
        failedDescription: "Failed to save data, please check your data and internet connection then try again!"
      };

      const idValidation = {
        required: "Kolom ini wajib diisi!",
        min: "Kolom harus berisi lebih dari {min} karakter!",
        max: "Kolom harus kurang dari {max} karakter!",
        min_max: "Kolom harus berisi antara {min} - {max} karakter!",
        phone: "Silakan masukkan nomor telepon yang valid!",
        url: "Silakan masukkan URL yang valid!",
        uppercase: "Kolom harus mengandung minimal 1 huruf besar!",
        lowercase: "Kolom harus mengandung minimal 1 huruf kecil!",
        numeric: "Kolom harus mengandung minimal 1 angka!",
        email: "Silakan masukkan alamat email yang valid!",
        in: "Kolom harus berupa salah satu dari: {keywords}!",
        not_in: "Kolom tidak boleh berupa salah satu dari: {keywords}!",
        regex: "Silakan masukkan format yang valid!",
        invalid_file_type: "Hanya memperbolehkan ekstensi {extension}!",
        max_file_size: "Ukuran file maksimum {maxFileSize} Mb!"
      };

      const enValidation = {
        required: "Please fill in this field!",
        min: "Field must contain more than {min} characters!",
        max: "Field must be less than {max} characters!",
        min_max: "Field must be {min} - {max} characters!",
        phone: "Please enter a valid mobile number!",
        url: "Please enter a valid URL!",
        uppercase: "Field must contain at least 1 uppercase letter!",
        lowercase: "Field must contain at least 1 lowercase letter!",
        numeric: "Field must contain at least 1 number!",
        email: "Please enter a valid email address!",
        in: "Field must be one of: {keywords}!",
        not_in: "Field cannot be one of: {keywords}!",
        regex: "Please enter a valid format!",
        invalid_file_type: "Only extensions {extension} are allowed!",
        max_file_size: "Maximum file size is {maxFileSize} Mb!"
      };

      fs.writeFileSync(path.join(langsIdDir, "base.json"), JSON.stringify(idBase, null, 2), "utf8");
      fs.writeFileSync(path.join(langsEnDir, "base.json"), JSON.stringify(enBase, null, 2), "utf8");
      fs.writeFileSync(path.join(langsIdDir, "validation.json"), JSON.stringify(idValidation, null, 2), "utf8");
      fs.writeFileSync(path.join(langsEnDir, "validation.json"), JSON.stringify(enValidation, null, 2), "utf8");

      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts["lang:build"] = "skalfa lang build";
        pkg.scripts["lang:dev"] = "skalfa lang dev";
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
      }
    } else {
      console.log(`Installing Skalfa extension: ${extensionName}`);
      installPackage(projectRoot, packageName);
      console.log(`Installed ${packageName}`);
    }
}

async function getTemplateSource(projectRoot: string): Promise<{ templateSource: string; cleanup: () => void }> {
  const envTemplateSource = process.env["SKALFA_API_TEMPLATE"];
  let tempExtractDir: string | null = null;
  let templateSource = "";

  if (envTemplateSource) {
    templateSource = path.resolve(envTemplateSource);
    if (!exists(templateSource)) {
      throw new Error(`Template source override not found: ${templateSource}`);
    }
    return { templateSource, cleanup: () => {} };
  } else {
    const templatePackageName = "@skalfa/skalfa-api";
    console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
    const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

    const parentDir = path.dirname(projectRoot);
    tempExtractDir = path.join(parentDir, `skalfa-temp-extract-${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });

    const tarballPath = path.join(tempExtractDir, "template.tgz");
    console.log("Downloading template tarball...");
    await downloadTarball(tarballUrl, tarballPath);

    console.log("Extracting template...");
    try {
      execSync(`tar -xzf "${tarballPath}" -C "${tempExtractDir}"`, { stdio: "ignore" });
    } catch (err) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error(`Failed to extract template tarball. Please ensure 'tar' command is available: ${(err as Error).message}`);
    }

    templateSource = path.join(tempExtractDir, "package");
    if (!exists(templateSource)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error("Invalid template structure: 'package' folder not found inside tarball.");
    }

    return {
      templateSource,
      cleanup: () => {
        if (tempExtractDir && exists(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
      }
    };
  }
}

async function getAppTemplateSource(projectRoot: string): Promise<{ templateSource: string; cleanup: () => void }> {
  const envTemplateSource = process.env["SKALFA_APP_TEMPLATE"];
  let tempExtractDir: string | null = null;
  let templateSource = "";

  if (envTemplateSource) {
    templateSource = path.resolve(envTemplateSource);
    if (!exists(templateSource)) {
      throw new Error(`Template source override not found: ${templateSource}`);
    }
    return { templateSource, cleanup: () => {} };
  } else {
    const templatePackageName = "@skalfa/skalfa-app";
    console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
    const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

    const parentDir = path.dirname(projectRoot);
    tempExtractDir = path.join(parentDir, `skalfa-app-temp-extract-${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });

    const tarballPath = path.join(tempExtractDir, "template.tgz");
    console.log("Downloading template tarball...");
    await downloadTarball(tarballUrl, tarballPath);

    console.log("Extracting template...");
    try {
      execSync(`tar -xzf "${tarballPath}" -C "${tempExtractDir}"`, { stdio: "ignore" });
    } catch (err) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error(`Failed to extract template tarball. Please ensure 'tar' command is available: ${(err as Error).message}`);
    }

    templateSource = path.join(tempExtractDir, "package");
    if (!exists(templateSource)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error("Invalid template structure: 'package' folder not found inside tarball.");
    }

    return {
      templateSource,
      cleanup: () => {
        if (tempExtractDir && exists(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
      }
    };
  }
}

async function scaffoldOrmExtension(projectRoot: string): Promise<void> {
  const { templateSource, cleanup } = await getTemplateSource(projectRoot);

  try {
    console.log("Scaffolding database and model directories...");
    const dbSrc = path.join(templateSource, "database");
    const dbDest = path.join(projectRoot, "database");
    if (exists(dbSrc)) {
      copyTemplate(dbSrc, dbDest);
    }

    const modelsSrc = path.join(templateSource, "app", "models");
    const modelsDest = path.join(projectRoot, "app", "models");
    if (exists(modelsSrc)) {
      copyTemplate(modelsSrc, modelsDest);
    }

    console.log("Restoring database-enabled controllers...");
    const authControllerSrc = path.join(templateSource, "app", "controllers", "iam", "auth.controller.ts");
    const authControllerDest = path.join(projectRoot, "app", "controllers", "iam", "auth.controller.ts");
    if (exists(authControllerSrc)) {
      fs.mkdirSync(path.dirname(authControllerDest), { recursive: true });
      fs.copyFileSync(authControllerSrc, authControllerDest);
    }

    const userControllerSrc = path.join(templateSource, "app", "controllers", "iam", "user.controller.ts");
    const userControllerDest = path.join(projectRoot, "app", "controllers", "iam", "user.controller.ts");
    if (exists(userControllerSrc)) {
      fs.mkdirSync(path.dirname(userControllerDest), { recursive: true });
      fs.copyFileSync(userControllerSrc, userControllerDest);
    }

    console.log("Restoring database CLI commands...");
    const commandsSrc = path.join(templateSource, "utils", "commands");
    const commandsDest = path.join(projectRoot, "utils", "commands");
    if (exists(commandsSrc)) {
      const skalfaCliSrc = path.join(commandsSrc, "skalfa.ts");
      const skalfaCliDest = path.join(commandsDest, "skalfa.ts");
      if (exists(skalfaCliSrc) && !exists(skalfaCliDest)) {
        fs.mkdirSync(path.dirname(skalfaCliDest), { recursive: true });
        fs.copyFileSync(skalfaCliSrc, skalfaCliDest);
      }
    }

    console.log("Restoring database initialization in app/app.ts...");
    const appTsSrc = path.join(templateSource, "app", "app.ts");
    const appTsDest = path.join(projectRoot, "app", "app.ts");
    if (exists(appTsSrc) && exists(appTsDest)) {
      const templateAppTs = fs.readFileSync(appTsSrc, "utf8");
      const regex = /(\/\/ ## Init: database\s*\r?\n\/\/ =====================================>\r?\n)([\s\S]*?)(\r?\n\/\/ =====================================>)/;
      const match = templateAppTs.match(regex);
      if (match) {
        const dbBlock = match[2];
        let targetAppTs = fs.readFileSync(appTsDest, "utf8");
        targetAppTs = targetAppTs.replace(
          /(\/\/ ## Init: database\s*\r?\n\/\/ =====================================>\r?\n)([\s\S]*?)(\r?\n\/\/ =====================================>)/,
          `$1${dbBlock}$3`
        );
        if (!targetAppTs.match(/\bdb\b/)) {
          targetAppTs = targetAppTs.replace(/(\bcontroller\b|\blogger\b)/, "db, $1");
        }
        fs.writeFileSync(appTsDest, targetAppTs, "utf8");
      }
    }

    console.log("Updating tsconfig.json paths...");
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    if (exists(tsconfigPath)) {
      let content = fs.readFileSync(tsconfigPath, "utf8");
      if (!content.includes("@skalfa/skalfa-orm")) {
        content = content.replace(
          /("@utils\/\*"\s*:\s*\[\s*"utils\/\*",)/,
          `$1\n        "node_modules/@skalfa/skalfa-orm/dist/*",`
        );
        fs.writeFileSync(tsconfigPath, content, "utf8");
      }
    }

    console.log("Updating utils/index.ts exports...");
    const utilsIndexPath = path.join(projectRoot, "utils", "index.ts");
    if (exists(utilsIndexPath)) {
      let content = fs.readFileSync(utilsIndexPath, "utf8");
      if (!content.includes("@skalfa/skalfa-orm")) {
        content = content.replace(
          /export \* from "@skalfa\/skalfa-api-core";/,
          `export * from "@skalfa/skalfa-api-core";\nexport * from "@skalfa/skalfa-orm";`
        );
        content = content.replace(/export const db: any = null;\r?\n/, "");
        content = content.replace(/export const Model: any = null;\r?\n/, "");
        fs.writeFileSync(utilsIndexPath, content, "utf8");
      }
    }
  } finally {
    cleanup();
  }

  console.log("✓ ORM initialization and scaffolding successfully restored!");
}

async function scaffoldUtilityExtension(projectRoot: string, ext: string): Promise<void> {
  const { templateSource, cleanup } = await getTemplateSource(projectRoot);

  try {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    const utilsIndexPath = path.join(projectRoot, "utils", "index.ts");
    const appTsPath = path.join(projectRoot, "app", "app.ts");

    if (ext === "queue") {
      console.log("Copying Queue worker examples...");
      const src = path.join(templateSource, "app", "jobs", "queues");
      const dest = path.join(projectRoot, "app", "jobs", "queues");
      copyTemplate(src, dest);

      const packageJsonPath = path.join(projectRoot, "package.json");
      let hasDa = false;
      let hasNotification = false;
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const deps = pkg.dependencies || {};
        hasDa = !!deps["@skalfa/skalfa-da"];
        hasNotification = !!deps["@skalfa/notification"] || !!deps["skalfa-notification"];
      }
      cleanQueueWorkers(projectRoot, hasDa, hasNotification);
    } else if (ext === "cron") {
      console.log("Copying Cron job examples...");
      const src = path.join(templateSource, "app", "jobs", "crons");
      const dest = path.join(projectRoot, "app", "jobs", "crons");
      copyTemplate(src, dest);
    } else if (ext === "socket") {
      console.log("Copying Socket.io handler examples...");
      const src = path.join(templateSource, "app", "jobs", "sockets");
      const dest = path.join(projectRoot, "app", "jobs", "sockets");
      copyTemplate(src, dest);
    } else if (ext === "da") {
      console.log("Copying Data Analytics OLAP migrations...");
      const src = path.join(templateSource, "database", "da.migrations");
      const dest = path.join(projectRoot, "database", "da.migrations");
      copyTemplate(src, dest);
    }

    addTsconfigPath(tsconfigPath, `@skalfa/skalfa-${ext}`);
    if (ext === "queue" || ext === "cache") {
      addTsconfigPath(tsconfigPath, "@skalfa/skalfa-redis");
    }

    addUtilExport(utilsIndexPath, `@skalfa/skalfa-${ext}`);
    if (ext === "queue" || ext === "cache") {
      addUtilExport(utilsIndexPath, "@skalfa/skalfa-redis");
    }

    if (fs.existsSync(appTsPath)) {
      let content = fs.readFileSync(appTsPath, "utf8");
      const importsToAdd: string[] = [];

      if (ext === "redis" || ext === "queue" || ext === "cache") {
        importsToAdd.push("redis");
        content = content.replace(
          /\/\/ if \(process\.env\.REDIS_HOST[\s\S]*?\/\/ \}/g,
          (match) => match.replace(/^\/\/ ?/gm, "")
        );
      }
      if (ext === "da") {
        importsToAdd.push("daClient");
        content = content.replace(
          /\/\/ if \(process\.env\.DA_HOST[\s\S]*?\/\/ }/g,
          (match) => match.replace(/^\/\/ ?/gm, "")
        );
      }

      if (importsToAdd.length > 0) {
        const importRegex = /import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*["']@utils["']/;
        const match = content.match(importRegex);
        if (match) {
          const currentImports = match[1].split(",").map(i => i.trim()).filter(Boolean);
          const finalImports = Array.from(new Set([...currentImports, ...importsToAdd]));
          const newImportLine = `import { ${finalImports.join(", ")} } from "@utils"`;
          content = content.replace(importRegex, newImportLine);
        }
      }

      fs.writeFileSync(appTsPath, content, "utf8");
    }

    const packageJsonPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(packageJsonPath) && ["cron", "queue", "socket"].includes(ext)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      pkg.scripts = pkg.scripts || {};

      let scriptKey = "";
      let scriptVal = "";
      if (ext === "cron") {
        scriptKey = "start:cron";
        scriptVal = "bun run app/jobs/crons/worker.cron.ts";
      } else if (ext === "queue") {
        scriptKey = "start:queue";
        scriptVal = "bun run app/jobs/queues/worker.queue.ts";
      } else if (ext === "socket") {
        scriptKey = "start:socket";
        scriptVal = "bun run app/jobs/sockets/worker.socket.ts";
      }

      if (scriptKey) {
        pkg.scripts[scriptKey] = scriptVal;

        const devScript = pkg.scripts["dev"] || "";
        const runCmd = `bun ${scriptKey}`;

        if (devScript.includes("concurrently")) {
          if (!devScript.includes(runCmd)) {
            const cleanDev = devScript.trim();
            pkg.scripts["dev"] = `${cleanDev} '${runCmd}'`;
          }
        } else {
          pkg.scripts["dev"] = `concurrently --raw 'bun run --watch app/app.ts' 'bun skalfa watch:barrels' '${runCmd}'`;
        }
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
    }
  } finally {
    cleanup();
  }

  console.log(`✓ Extension "${ext}" successfully configured!`);
}

function addTsconfigPath(tsconfigPath: string, packageName: string): void {
  if (!fs.existsSync(tsconfigPath)) return;
  let content = fs.readFileSync(tsconfigPath, "utf8");
  if (!content.includes(packageName)) {
    content = content.replace(
      /("@utils\/\*"\s*:\s*\[\s*"utils\/\*",)/,
      `$1\n        "node_modules/${packageName}/dist/*",`
    );
    fs.writeFileSync(tsconfigPath, content, "utf8");
  }
}

function addUtilExport(utilsIndexPath: string, packageName: string): void {
  if (!fs.existsSync(utilsIndexPath)) return;
  let content = fs.readFileSync(utilsIndexPath, "utf8");
  if (!content.includes(packageName)) {
    content += `export * from "${packageName}";\n`;
    fs.writeFileSync(utilsIndexPath, content, "utf8");
  }
}

function cleanQueueWorkers(targetDir: string, hasDa: boolean, hasNotification: boolean): void {
  const queuesDir = path.join(targetDir, "app", "jobs", "queues");
  const workerQueuePath = path.join(queuesDir, "worker.queue.ts");
  if (!fs.existsSync(workerQueuePath)) return;

  let content = fs.readFileSync(workerQueuePath, "utf8");

  if (!hasDa) {
    const daFiles = [
      "access-log.queue.worker.ts",
      "activity-log.queue.worker.ts",
      "error-log.queue.worker.ts"
    ];
    for (const file of daFiles) {
      const p = path.join(queuesDir, file);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    content = content.replace(/import\s*\{\s*activityLogQueueWorker\s*\}\s*from\s*["']\.\/activity-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/import\s*\{\s*accessLogQueueWorker\s*\}\s*from\s*["']\.\/access-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/import\s*\{\s*errorLogQueueWorker\s*\}\s*from\s*["']\.\/error-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/activityLogQueueWorker\(\)\r?\n?/g, "");
    content = content.replace(/accessLogQueueWorker\(\)\r?\n?/g, "");
    content = content.replace(/errorLogQueueWorker\(\)\r?\n?/g, "");
  }

  if (!hasNotification) {
    const p = path.join(queuesDir, "notification.queue.worker.ts");
    if (fs.existsSync(p)) fs.unlinkSync(p);
    content = content.replace(/import\s*\{\s*notificationQueueWorker\s*\}\s*from\s*["']\.\/notification\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/notificationQueueWorker\(\)\r?\n?/g, "");
  }

  fs.writeFileSync(workerQueuePath, content, "utf8");
}