import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import * as zl from "../../src";

describe("zip", () => {
    it("advance zip", async () => {
        const zip = new zl.Zip();
        zip.addFile(path.join(__dirname, "../resources/src - shortcut.lnk"), "test.lnk");
        zip.addFile(path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt"), "ddddd.txt");
        zip.addFolder(path.join(__dirname, "../resources/subfolder"), "new subfolder");
        zip.addFolder(path.join(__dirname, "../resources/name with space"));
        const target = path.join(__dirname, "../zips/resources_advance.zip");
        await zip.archive(target);
        const unzipTarget = path.join(__dirname, "../unzips/resources_advance");
        await zl.extract(target, unzipTarget, {
            overwrite: true,
        });
        fs.accessSync(path.join(unzipTarget, "test.lnk"));
        fs.accessSync(path.join(unzipTarget, "ddddd.txt"));
        fs.accessSync(path.join(unzipTarget, "new subfolder/test text.txt"));
        fs.accessSync(path.join(unzipTarget, "new subfolder/test.txt"));
        expect(fs.existsSync(path.join(unzipTarget, "new subfolder/test.txt - shortcut.lnk"))).toBe(true);
    });

    it("advance zip with options",  async () => {
        // Do not include milliseconds in these timestamps as many filesystems only store up to seconds in precision.
        const dateInitial = new Date("2026-01-01T00:00:00.000Z");
        const dateFile = new Date(0);
        const dateFolderFiles = new Date("2024-12-31T12:34:56.000Z");
        const dateDefault = new Date("2000-01-01T23:59:59.000Z");

        const zip = new zl.Zip({ mode: 0o600, mtime: dateDefault });

        const fileLnk = path.join(__dirname, "../resources/src - shortcut.lnk");
        const fileTxt = path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt");
        const folderNew = path.join(__dirname, "../resources/subfolder");
        const folderWithSpace = path.join(__dirname, "../resources/name with space");

        [fileLnk, fileTxt].forEach(file => {
            fs.chmodSync(file, 0o644); // ensure files have default permission bits to test overrides actually work
            fs.utimesSync(file, dateInitial, dateInitial); // same as above but for mtime
        });;
        [folderNew, folderWithSpace].forEach(folder => {
            fs.chmodSync(folder, 0o711); // ensure folders have default permission bits to test overrides actually work
            fs.utimesSync(folder, dateInitial, dateInitial); // same as above but for mtime
        });
        zip.addFile(fileLnk, "test2.lnk", { mtime: dateFile });
        zip.addFile(fileTxt, "ddddd2.txt", { mode: 0o604, mtime: dateFile });
        zip.addFolder(folderNew, "new subfolder2", { mode: 0o700, mtime: dateFolderFiles });
        zip.addFolder(folderWithSpace, "name with space2", { mode: 0o750 });

        const target = path.join(__dirname, "../zips/resources_advance.zip");
        await zip.archive(target);
        const unzipTarget = path.join(__dirname, "../unzips/resources_advance");
        await zl.extract(target, unzipTarget, {
            overwrite: true,
            preserveLastModifiedTimestamps: true,
        });

        // masking the returned mode is necessary to strip unwanted potential non-standard permission bits
        // (i.e. the com.apple.provenance bit on macOS)

        const statLnk = fs.statSync(path.join(unzipTarget, "test2.lnk"));
        expect(statLnk.mode & 0o777).toBe(0o600); // should use default from Zip constructor
        expect(statLnk.mtime.getTime()).toBe(dateFile.getTime());
        
        const statTxt = fs.statSync(path.join(unzipTarget, "ddddd2.txt"));
        expect(statTxt.mode & 0o777).toBe(0o604);
        expect(statTxt.mtime.getTime()).toBe(dateFile.getTime());

        // Due to how ZIP files don't save dedicated entries for folders unless it's an empty folder, we cannot check
        // "name with space2" or "new subfolder2" for their mode/mtime, because those simply don't exist for them in the ZIP.
        const statFolderWithSpace = fs.statSync(path.join(unzipTarget, "name with space2/empty folder"));
        expect(statFolderWithSpace.mode & 0o777).toBe(0o755); // folders should always be 0o755 / not have mode overrides applied
        expect(statFolderWithSpace.mtime.getTime()).toBe(dateDefault.getTime()); // should use default from Zip constructor
    
        const statFolderFile1 = fs.statSync(path.join(unzipTarget, "new subfolder2/test text.txt"));
        expect(statFolderFile1.mode & 0o777).toBe(0o700);
        expect(statFolderFile1.mtime.getTime()).toBe(dateFolderFiles.getTime());
        const statFolderFile2 = fs.statSync(path.join(unzipTarget, "new subfolder2/test.txt"));
        expect(statFolderFile2.mode & 0o777).toBe(0o700); 
        expect(statFolderFile2.mtime.getTime()).toBe(dateFolderFiles.getTime());

        expect(fs.existsSync(path.join(unzipTarget, "new subfolder2/test.txt - shortcut.lnk"))).toBe(true);
    });

    it("advance zip with forced modes",  async () => {
        const zip = new zl.Zip({ mode: 0o644 });

        const fileLnk = path.join(__dirname, "../resources/src - shortcut.lnk");
        const fileTxt = path.join(__dirname, "../resources/¹ º » ¼ ½ ¾.txt");
        const folderNew = path.join(__dirname, "../resources/subfolder");
        const folderWithSpace = path.join(__dirname, "../resources/name with space");

        zip.addFile(fileLnk, "test2.lnk");
        zip.addFile(fileTxt, "ddddd2.txt", { mode: 0o604 });
        zip.addFolder(folderNew, "new subfolder2", { mode: 0o700 });
        zip.addFolder(folderWithSpace, "name with space2", { mode: 0o750 });

        const target = path.join(__dirname, "../zips/resources_advance.zip");
        await zip.archive(target);
        const unzipTarget = path.join(__dirname, "../unzips/resources_advance");
        await zl.extract(target, unzipTarget, {
            overwrite: true,
            forceFileMode: 0o611,
            forceDirMode: 0o605, // also testing automatic 0o700 enforcement for folders.
        });

        // masking the returned mode is necessary to strip unwanted potential non-standard permission bits
        // (i.e. the com.apple.provenance bit on macOS)

        const statLnk = fs.statSync(path.join(unzipTarget, "test2.lnk"));
        expect(statLnk.mode & 0o777).toBe(0o611);
        
        const statTxt = fs.statSync(path.join(unzipTarget, "ddddd2.txt"));
        expect(statTxt.mode & 0o777).toBe(0o611);

        // Due to how ZIP files don't save dedicated entries for folders unless it's an empty folder, we cannot check
        // "name with space2" or "new subfolder2" for their mode, because it simply doesn't exist for them in the ZIP.
        const statFolderWithSpace = fs.statSync(path.join(unzipTarget, "name with space2/empty folder"));
        expect(statFolderWithSpace.mode & 0o777).toBe(0o705);
    
        const statFolderFile1 = fs.statSync(path.join(unzipTarget, "new subfolder2/test text.txt"));
        expect(statFolderFile1.mode & 0o777).toBe(0o611);
        const statFolderFile2 = fs.statSync(path.join(unzipTarget, "new subfolder2/test.txt"));
        expect(statFolderFile2.mode & 0o777).toBe(0o611); 

        expect(fs.existsSync(path.join(unzipTarget, "new subfolder2/test.txt - shortcut.lnk"))).toBe(true);
    });
});
