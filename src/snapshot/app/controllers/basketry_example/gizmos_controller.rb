# This code was generated by @basketry/rails@{{version}}
#
# Changes to this file may cause incorrect behavior and will be lost if
# the code is regenerated.
#
# To make changes to the contents of this file:
# 1. Edit source/path.ext
# 2. Run the Basketry CLI
#
# About Basketry: https://github.com/basketry/basketry/wiki
# About @basketry/rails: https://github.com/basketry/rails#readme

module BasketryExample
  class GizmosController < ActionController::Base
    include BasketryExample::ControllerHelpers

    def get_gizmos
      response = gizmo_service.get_gizmos(
        search: params['search']
      )

      render json: map_gizmos_response_to_dto(response), status: get_status_code(response)
    end

    def create_gizmo
      response = gizmo_service.create_gizmo(
        size: params['size']
      )

      render json: map_gizmo_to_dto(response), status: get_status_code(response)
    end

    def update_gizmo
      response = gizmo_service.update_gizmo(
        factors: params['factors']&.split(',')
      )

      render json: map_gizmo_to_dto(response), status: get_status_code(response)
    end
  end
end
