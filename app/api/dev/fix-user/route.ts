import { NextResponse } from "next/server"

// This route used to reset one account's password to a value written in this
// file, for anyone who requested the URL. It is disabled. The file is kept only
// so the URL answers 410 instead of 404 while old links age out; delete the
// folder whenever convenient.
export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 })
}
