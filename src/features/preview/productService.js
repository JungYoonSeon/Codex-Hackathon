import { Asset } from "expo-asset";
import { preparePhoto } from "./photo";
import { SAMPLE_ROOM_IMAGE } from "./sampleScenario";
export function createProductPreviewService({
  liveService,
  products,
  targets,
  references,
  focus,
  description,
}) {
  let preparedPhoto;
  return {
    mode: "live",
    async getRecommendations() {
      return {
        candidates: products
          .slice(0, 2)
          .map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            ...p.dimensions,
            description: p.description ?? "",
            tags: p.tags ?? [],
            dataMode: p.dataMode,
            catalogProduct: p,
            matchReason:
              "Your selected product. Appearance preview and measured fit checks are separate.",
          })),
        notice:
          "Each selected product is generated independently in the same original room photo.",
      };
    },
    async generatePreview(input) {
      let photo = input.photo;
      if (photo.source === "sample") {
        if (!preparedPhoto)
          preparedPhoto = (async () => {
            const asset = Asset.fromModule(SAMPLE_ROOM_IMAGE);
            await asset.downloadAsync();
            return preparePhoto({ uri: asset.localUri ?? asset.uri });
          })();
        photo = await preparedPhoto;
      }
      return liveService.generateProductPreview({
        ...input,
        photo,
        referencePhoto: references?.[input.candidate.id],
        target: targets[input.candidate.id] ?? { x: 0.5, y: 0.75, rotation: 0 },
        focus: focus ?? "whole",
        description: description ?? "",
      });
    },
  };
}
