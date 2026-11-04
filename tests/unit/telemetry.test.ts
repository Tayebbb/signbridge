import {test,expect} from "vitest";
import {browserClass} from "@/lib/player/telemetry";
test.each([["iPhone Version/18 Safari/605","ios:safari"],["iPhone CriOS/140 Safari/605","ios:chrome"],["iPad FxiOS/140 Safari/605","ios:firefox"],["Android Chrome/140 Safari/537","android:chrome"],["Windows Chrome/140 Edg/140","desktop:edge"],["unknown","desktop:other"]])("Device grouping is coarse and bounded (%s)",(ua,expected)=>expect(browserClass(ua)).toBe(expected));
