import { redirect } from "next/navigation";
// "Trace your gift" form on the home page posts ?id=<donation number> here.
export default async function TraceLookup({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const id = Number((await searchParams).id);
  redirect(Number.isInteger(id) && id > 0 ? `/trace/${id}` : "/");
}
