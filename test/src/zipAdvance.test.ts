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
        const dateInitial = new Date("2026-01-01T00:00:00.000Z");
        const dateFile = new Date(0);
        const dateFolder = new Date("2024-12-31T12:34:56.789Z");
        const dateDefault = new Date("2000-01-01T23:59:59.999Z");

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
            fs.chmodSync(folder, 0o755); // ensure folders have default permission bits to test overrides actually work
            fs.utimesSync(folder, dateInitial, dateInitial); // same as above but for mtime
        });
        zip.addFile(fileLnk, "test.lnk", { mtime: dateFile });
        zip.addFile(fileTxt, "ddddd.txt", { mode: 0o604, mtime: dateFile });
        zip.addFolder(folderNew, "new subfolder", { mode: 0o700, mtime: dateFolder });
        zip.addFolder(folderWithSpace, "name with space", { mode: 0o750 });

        const target = path.join(__dirname, "../zips/resources_advance.zip");
        await zip.archive(target);
        const unzipTarget = path.join(__dirname, "../unzips/resources_advance");
        await zl.extract(target, unzipTarget, {
            overwrite: true,
        });

        // masking the returned mode is necessary to strip unwanted potential non-standard permission bits
        // (i.e. the com.apple.provenance bit on macOS)

        const statLnk = fs.statSync(path.join(unzipTarget, "test.lnk"));
        expect(statLnk.mode & 0o777).toBe(0o600); // should use default from Zip constructor
        expect(statLnk.mtime.getTime()).toBe(dateFile.getTime());
        
        const statTxt = fs.statSync(path.join(unzipTarget, "ddddd.txt"));
        expect(statTxt.mode & 0o777).toBe(0o604);
        expect(statTxt.mtime.getTime()).toBe(dateFile.getTime());

        const statFolderNew = fs.statSync(path.join(unzipTarget, "new subfolder"));
        expect(statFolderNew.mode & 0o777).toBe(0o700);
        expect(statFolderNew.mtime.getTime()).toBe(dateFolder.getTime());

        const statFolderWithSpace = fs.statSync(path.join(unzipTarget, "name with space"));
        expect(statFolderWithSpace.mode & 0o777).toBe(0o750);
        expect(statFolderWithSpace.mtime.getTime()).toBe(dateDefault.getTime()); // should use default from Zip constructor
    
        const statFolderFile1 = fs.statSync(path.join(unzipTarget, "new subfolder/test text.txt"));
        expect(statFolderFile1.mode & 0o777).toBe(0o700);
        expect(statFolderFile1.mtime.getTime()).toBe(dateFolder.getTime());
        const statFolderFile2 = fs.statSync(path.join(unzipTarget, "new subfolder/test.txt"));
        expect(statFolderFile2.mode & 0o777).toBe(0o700); 
        expect(statFolderFile2.mtime.getTime()).toBe(dateFolder.getTime());

        expect(fs.existsSync(path.join(unzipTarget, "new subfolder/test.txt - shortcut.lnk"))).toBe(true);
    });
});
