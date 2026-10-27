import type { Route } from "./+types/item-original";
import { redirect } from "react-router";
export { default, handle, headers, meta } from "./item";

export async function loader({ params }: Route.LoaderArgs) {
  return redirect(`/items/${encodeURIComponent(params.id)}`, 308);
}
