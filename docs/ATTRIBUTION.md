# Attribution

- Sign data: IsharaKotha v2, CC BY 4.0. The phase-1 fixture comes from `E:/AIgnite-Lab/research/2026-11-03-signbridge/system-design-review/cross-file-case-1.sigml`. Only gloss attribute values are converted to lowercase to meet the v1.1 identifier contract. Original dataset attribution/provenance is retained in `docs/evidence/fixture-provenance.json`.
- Renderer: University of East Anglia, CWASA vhg2026, standard Anna avatar. The engine, configuration and avatar are fetched directly from UEA without modification or redistribution. [Release](https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/) · [conditions of use](https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use).
- The UEA software is subject to conditions equivalent to CC BY-ND; its example pages have separate CC BY-SA terms. The local host/wrapper is project code using the documented interface, not a modified engine.
- Official event sticker: supplied by the owner, who confirmed it is the organizer asset. The original `public/event-sticker.png` bytes are retained and used prominently in the live top banner; no imitation was created. [Recorded provenance](evidence/final/sticker-provenance.json).

The fixture combines unrelated corpus entries. Animation is technical evidence only; it is not evidence of correct BdSL or comprehension.

Phase 2 additionally imports the public [IsharaKotha v2 release](https://data.mendeley.com/datasets/6ykgx65ks5/2), DOI 10.17632/6ykgx65ks5.2, under CC BY 4.0. Authors: MD. Ashikul Islam; Prato Dewan; Md Fuadul Islam; Md Ataullha Saim; M Shahidur Rahman. Each accepted asset retains original byte hash, source filenames/paths and public source URLs. The release row and emitted SQL retain author attribution and the license.

Changes: original gloss attribute values are replaced with lowercase ASCII placeholders, and document-level wrappers are assembled. Motion XML inside sign units is retained byte-for-byte apart from those gloss values. Rejected inputs are quarantined with reasons rather than repaired or stripped of unsupported annotations. Rendering evidence does not establish correct BdSL or comprehension.

The About page retains these author, license and modification notices. SignBridge uses prior text/video-to-avatar research as context and does not claim invention of that idea; examples include SignOLight and IsharaKotha. Newly assembled sequences are experimental and unreviewed. No qualified linguistic assessment or user-comprehension result is asserted.

The ordinary-video tests use Wikitongues / Hardeep Singh's [Pradeep speaking Bengali](https://commons.wikimedia.org/wiki/File:WIKITONGUES-_Pradeep_speaking_Bengali.webm), with published Bangla captions, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The first 28.763 seconds were resized/transcoded; the first eight caption cues retain their original wording. Adapted source/caption content retains that license. Test screenshots and reports credit the source and do not imply endorsement. [Source metadata](evidence/normal-video-2026-11-05/source.json).

The submission deck and English voiced explainer were supplied by the project owner. Their older verification counts are an earlier snapshot, explicitly distinguished from the [current follow-up](COVERAGE-FOLLOWUP.md). The supplied deck is copied without changing its bytes; the video is uploaded from the supplied voiced MP4 rather than the earlier silent file.
