import { act, renderHook } from "@testing-library/react";
import {
  useProjectsListFilters,
  useProjectsArchivedFilters,
  type ProjectsListFiltersState,
  type ProjectsArchivedFiltersState,
} from "../useProjectsFilters";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

type Option = { id: string; name: string };

describe("useProjectsListFilters", () => {
  it("preserves state reference when option arrays change identity without content differences", async () => {
    const initialProps = {
      typeOptions: [
        { id: "type-a", name: "Type A" },
        { id: "type-b", name: "Type B" },
      ],
      stageOptions: [{ id: "stage-a", name: "Stage A" }],
      serviceOptions: [{ id: "service-a", name: "Service A" }],
    };

    const { result, rerender } = renderHook(
      (props: {
        typeOptions: Option[];
        stageOptions: Option[];
        serviceOptions: Option[];
      }) => useProjectsListFilters(props),
      { initialProps }
    );

    const initialState = result.current.state;

    await act(async () => {
      rerender({
        typeOptions: [...initialProps.typeOptions],
        stageOptions: [...initialProps.stageOptions],
        serviceOptions: [...initialProps.serviceOptions],
      });
    });

    expect(result.current.state).toBe(initialState);
  });

  it("drops filtered selections when option sets shrink", async () => {
    const initialState: ProjectsListFiltersState = {
      types: ["type-a", "type-b"],
      stages: ["stage-a"],
      sessionPresence: "any",
      progress: "any",
      services: ["service-a", "service-b"],
    };

    const initialProps = {
      typeOptions: [
        { id: "type-a", name: "Type A" },
        { id: "type-b", name: "Type B" },
      ],
      stageOptions: [{ id: "stage-a", name: "Stage A" }],
      serviceOptions: [
        { id: "service-a", name: "Service A" },
        { id: "service-b", name: "Service B" },
      ],
      initialState,
    };

    const { result, rerender } = renderHook(
      (props: {
        typeOptions: Option[];
        stageOptions: Option[];
        serviceOptions: Option[];
        initialState?: ProjectsListFiltersState;
      }) => useProjectsListFilters(props),
      { initialProps }
    );

    await act(async () => {
      rerender({
        typeOptions: [{ id: "type-a", name: "Type A" }],
        stageOptions: [{ id: "stage-a", name: "Stage A" }],
        serviceOptions: [{ id: "service-b", name: "Service B" }],
      });
    });

    expect(result.current.state.types).toEqual(["type-a"]);
    expect(result.current.state.services).toEqual(["service-b"]);
  });
});

describe("useProjectsArchivedFilters", () => {
  it("preserves state reference on identical option re-renders", async () => {
    const archivedInitialState: ProjectsArchivedFiltersState = {
      types: ["type-a"],
      balancePreset: "any",
      balanceMin: null,
      balanceMax: null,
    };

    const { result, rerender } = renderHook(
      (props: { typeOptions: Option[]; initialState?: ProjectsArchivedFiltersState }) =>
        useProjectsArchivedFilters(props),
      {
        initialProps: {
          typeOptions: [
            { id: "type-a", name: "Type A" },
            { id: "type-b", name: "Type B" },
          ],
          initialState: archivedInitialState,
        },
      }
    );

    const firstState = result.current.state;

    await act(async () => {
      rerender({
        typeOptions: [
          { id: "type-a", name: "Type A" },
          { id: "type-b", name: "Type B" },
        ],
      });
    });

    expect(result.current.state).toBe(firstState);
  });

  it("removes stale archived selections when options update", async () => {
    const archivedInitialState: ProjectsArchivedFiltersState = {
      types: ["type-a", "type-b"],
      balancePreset: "any",
      balanceMin: null,
      balanceMax: null,
    };

    const { result, rerender } = renderHook(
      (props: { typeOptions: Option[]; initialState?: ProjectsArchivedFiltersState }) =>
        useProjectsArchivedFilters(props),
      {
        initialProps: {
          typeOptions: [
            { id: "type-a", name: "Type A" },
            { id: "type-b", name: "Type B" },
          ],
          initialState: archivedInitialState,
        },
      }
    );

    await act(async () => {
      rerender({
        typeOptions: [{ id: "type-a", name: "Type A" }],
      });
    });

    expect(result.current.state.types).toEqual(["type-a"]);
  });
});
